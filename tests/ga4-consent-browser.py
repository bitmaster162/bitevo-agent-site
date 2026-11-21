"""Exercise the shipped Google tag with local BitEvo HTML and intercepted analytics traffic."""
import json
from html import escape
import mimetypes
import os
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ORIGIN = "https://bitevo.work"
MEASUREMENT_ID = "G-3XTVGVN2P5"
TAG = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID
MARKER = "private-consent-test-marker"
CSP = next(
    header["value"]
    for group in json.loads((ROOT / "vercel.json").read_text())["headers"]
    for header in group["headers"]
    if header["key"].lower() == "content-security-policy"
)

VERCEL_ROUTES = json.loads((ROOT / "vercel.json").read_text())["routes"]
assert VERCEL_ROUTES[0]["headers"]["Content-Security-Policy"] == CSP


class Visit:
    def __init__(self, browser, vendor, init=None):
        self.context = browser.new_context(service_workers="block")
        self.traffic = []
        self.vendor = vendor
        self.from_referrer = None
        self.context.route("**/*", self.serve)
        if init:
            self.context.add_init_script(init)
        self.page = self.context.new_page()

    def serve(self, route):
        request = route.request
        url = urlsplit(request.url)
        if request.is_navigation_request() and self.from_referrer and url.hostname in {"www.google.com", "unknown.example"}:
            return route.fulfill(
                content_type="text/html",
                body='<a referrerpolicy="unsafe-url" href="' + escape(self.from_referrer) + '">Visit BitEvo</a>',
            )
        if url.hostname in {"bitevo.work", "preview.vercel.app"}:
            file = DIST / url.path.lstrip("/")
            if file.is_dir():
                file = file / "index.html"
            if file.is_file():
                return route.fulfill(
                    body=file.read_bytes(),
                    content_type=mimetypes.guess_type(str(file))[0] or "application/octet-stream",
                    headers={"Content-Security-Policy": CSP},
                )
            if request.resource_type == "document":
                return route.fulfill(status=404, body=(DIST / "404.html").read_bytes(), content_type="text/html")
            return route.fulfill(status=404, body="")
        self.traffic.append((request.url, request.post_data or "", request.headers.get("referer", "")))
        if request.url == TAG:
            return route.fulfill(body=self.vendor, content_type="application/javascript")
        # No analytics collector or other external site ever receives browser requests.
        return route.fulfill(status=204, headers={"Access-Control-Allow-Origin": "*"})

    def ga_requests(self):
        suffixes = ("googletagmanager.com", "google-analytics.com", "analytics.google.com")
        return [r for r in self.traffic if any(
            urlsplit(r[0]).hostname == host or urlsplit(r[0]).hostname.endswith("." + host) for host in suffixes
        )]

    def views(self):
        views = []
        for url, body, _ in self.ga_requests():
            if urlsplit(url).path != "/g/collect":
                continue
            for line in body.splitlines() or [""]:
                params = {**parse_qs(urlsplit(url).query), **parse_qs(line)}
                if params.get("en") == ["page_view"]:
                    views.append(params)
        return views

    def wait_views(self, count):
        for _ in range(100):
            if len(self.views()) >= count:
                break
            self.page.wait_for_timeout(100)
        assert len(self.views()) == count, [(urlsplit(url).hostname, urlsplit(url).path) for url, _, _ in self.ga_requests()]
        return self.views()[-1]

    def goto(self, path="/", referrer=None):
        if referrer:
            self.from_referrer = ORIGIN + path
            self.page.goto(referrer)
            self.page.get_by_role("link", name="Visit BitEvo").click()
            self.page.wait_for_url(ORIGIN + path)
            self.from_referrer = None
            assert self.page.evaluate("document.referrer") == referrer
        else:
            self.page.goto(ORIGIN + path, wait_until="load")

    def action(self, label):
        preferences = self.page.locator("[data-ga-preferences]")
        if not preferences.evaluate("(el) => el.open"):
            preferences.locator("summary").click()
        preferences.get_by_role("button", name=label, exact=True).click()

    def assert_quiet(self, starting_count):
        self.page.wait_for_timeout(500)
        assert len(self.ga_requests()) == starting_count, self.ga_requests()[starting_count:]


def test_consent(browser, vendor):
    visit = Visit(browser, vendor)
    visit.goto(referrer="https://www.google.com/search?q=" + MARKER)
    visit.assert_quiet(0)
    visit.action("Decline / withdraw")
    visit.assert_quiet(0)
    visit.action("Allow analytics")
    # The known referring domain supplied a private query. Even with consent
    # the original request must not expose it to a tag that reads the DOM.
    visit.assert_quiet(0)
    # A same-document path/title change cannot make the unsafe referring
    # document eligible. BitEvo itself uses full-document navigation.
    visit.page.evaluate("value => { history.pushState({}, '', '/#' + value); document.title = value; }", MARKER)
    visit.action("Allow analytics")
    visit.assert_quiet(0)
    visit.page.evaluate("history.replaceState({}, '', '/')")
    visit.action("Allow analytics")
    visit.assert_quiet(0)
    visit.goto(referrer="https://www.google.com/")
    first = visit.wait_views(1)
    assert first["tid"] == [MEASUREMENT_ID] and first["dl"] == [ORIGIN + "/"]
    assert first.get("dr") == ["https://www.google.com/"] and first.get("dt") == [visit.page.locator('meta[property="og:title"]').get_attribute("content")], {
        key: first.get(key) for key in ("en", "tid", "dl", "dr", "dt")
    }
    assert any(url == TAG and not referrer for url, _, referrer in visit.ga_requests())
    visit.action("Allow analytics")
    visit.page.wait_for_timeout(500)
    assert len(visit.views()) == 1
    cookie_names = [c["name"] for c in visit.context.cookies()]
    print("GA cookie names before withdrawal", cookie_names, flush=True)
    print("GA consent fields", {key: first.get(key) for key in ("gcs", "gcd", "npa")}, flush=True)
    assert MARKER not in str(visit.ga_requests())

    visit.goto("/audit-intake", referrer="https://unknown.example/path?entry=" + MARKER)
    count = len(visit.ga_requests())
    visit.assert_quiet(count)
    assert visit.page.locator('script[src*="googletagmanager"]').count() == 0
    # Our referrer policy must protect same-origin navigation as well.
    visit.goto()
    visit.wait_views(2)
    with visit.page.expect_navigation():
        visit.page.evaluate("""() => {
          const link = document.createElement('a');
          link.href = '/audit-intake';
          document.body.append(link);
          link.click();
        }""")
    assert visit.page.evaluate("document.referrer") == ORIGIN + "/"
    visit.page.locator("#company").fill(MARKER)
    visit.page.locator("#contact").fill(MARKER + "@example.invalid")
    second = visit.wait_views(3)
    assert second["dl"] == [ORIGIN + "/audit-intake"] and second.get("dr", [ORIGIN + "/"]) == [ORIGIN + "/"], {
        key: second.get(key) for key in ("en", "tid", "dl", "dr", "dt")
    }
    assert MARKER not in str(visit.ga_requests())
    # Let the previous document finish sending its consented data before the
    # denied-page checks. The SDK can add automatic technical events.
    for path in ["/?q=" + MARKER, "/#" + MARKER, "/privacy", "/missing-" + MARKER]:
        visit.goto(path)
        before = len(visit.ga_requests())
        visit.assert_quiet(before)
        assert visit.page.locator('script[src*="googletagmanager"]').count() == 0
    assert len(visit.views()) == 3
    visit.goto("/ru")
    visit.wait_views(4)
    with visit.page.expect_navigation():
        visit.action("Отклонить / отозвать")
    assert not any(c["name"].startswith(("bitevoGa4_", "_ga")) for c in visit.context.cookies()), [c["name"] for c in visit.context.cookies()]
    before = len(visit.ga_requests())
    visit.goto()
    visit.assert_quiet(before)
    visit.action("Allow analytics")
    visit.wait_views(5)
    assert MARKER not in str(visit.ga_requests())
    print("Five intentional views on eligible documents; raw referrer and form values absent from intercepted requests")
    visit.context.close()


def test_failed_storage_and_privacy_signals(browser, vendor):
    for init in [
        "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {get: () => true})",
        "Object.defineProperty(Navigator.prototype, 'doNotTrack', {get: () => '1'})",
        "Object.defineProperty(window, 'localStorage', {get() { throw Error('disabled'); }})",
    ]:
        visit = Visit(browser, vendor, init)
        visit.goto()
        visit.action("Allow analytics")
        visit.assert_quiet(0)
        visit.context.close()

    visit = Visit(browser, vendor)
    visit.goto()
    visit.action("Allow analytics")
    visit.wait_views(1)
    broken = """() => {
      Storage.prototype.setItem = Storage.prototype.removeItem = () => {throw Error('read-only')};
    }"""
    visit.page.evaluate(broken)
    visit.context.add_init_script("(" + broken + ")()")
    with visit.page.expect_navigation():
        visit.action("Decline / withdraw")
    assert not any(c["name"].startswith(("bitevoGa4_", "_ga")) for c in visit.context.cookies()), [c["name"] for c in visit.context.cookies()]
    count = len(visit.ga_requests())
    visit.goto("/audit-intake")
    visit.assert_quiet(count)
    assert len(visit.views()) == 1
    visit.context.close()

    visit = Visit(browser, vendor)
    visit.page.goto("https://preview.vercel.app/")
    assert visit.page.locator("[data-ga-preferences]").count() == 0
    visit.assert_quiet(0)
    visit.context.close()


if __name__ == "__main__":
    with urlopen(TAG, timeout=25) as response:
        vendor = response.read()
    with sync_playwright() as playwright:
        with playwright.chromium.launch(executable_path=os.environ.get("CHROME_BIN")) as browser:
            test_consent(browser, vendor)
            test_failed_storage_and_privacy_signals(browser, vendor)
    print("GA4 consent browser regression passed; all collection remained intercepted")
