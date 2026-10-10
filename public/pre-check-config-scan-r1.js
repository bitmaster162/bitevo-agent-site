(() => {
  'use strict';

  const TEST_MODE = globalThis.__BITEVO_CONFIG_SCAN_R1_TEST__ === true;
  const SCHEMA = 'bitevo.pre-check-config-scan.r1';

  const RULES = Object.freeze([
    Object.freeze({
      id:'REMOTE_SHELL_PIPE',
      title:'Downloaded content piped directly to a shell',
      category:'shell_pipeline',
      pattern:/\b(?:curl|wget)\b[^\n|]{0,500}\|\s*(?:sudo\s+)?(?:bash|sh|zsh)\b/i,
      review:'Review the download source, integrity check and whether direct shell execution is necessary.'
    }),
    Object.freeze({
      id:'BASE64_DECODE',
      title:'Base64 decode instruction',
      category:'encoded_content',
      pattern:/\bbase64\b[^\n]{0,120}(?:-d|--decode)\b|\b(?:atob|frombase64string)\s*\(/i,
      review:'Review what is decoded and what happens to the decoded bytes before any execution or write.'
    }),
    Object.freeze({
      id:'SSH_MATERIAL_PATH',
      title:'SSH material path referenced',
      category:'sensitive_path',
      pattern:/(?:~|\$HOME|\$\{HOME\}|%USERPROFILE%)?[\\/]?\.ssh(?:[\\/]|\b)|%USERPROFILE%[\\/]\.ssh\b/i,
      review:'Review why SSH keys or configuration are in scope and keep credential material out of pasted instructions.'
    }),
    Object.freeze({
      id:'DOTENV_PATH',
      title:'.env file referenced',
      category:'sensitive_path',
      pattern:/(?:^|[\\/\s"'=])\.env(?:\.[A-Za-z0-9_-]+)?(?:$|[\\/\s"'\x60;,)])/i,
      review:'Review whether environment-secret files need to be read at all and avoid embedding their contents in instructions.'
    }),
    Object.freeze({
      id:'CREDENTIAL_STORE_PATH',
      title:'Credential-store path referenced',
      category:'sensitive_path',
      pattern:/(?:\.aws[\\/]credentials|\.git-credentials\b|\.npmrc\b|\.kube[\\/]config\b|\.config[\\/]gcloud\b)/i,
      review:'Review whether access to a local credential store is required and narrow the path/operation if it is.'
    }),
    Object.freeze({
      id:'DESTRUCTIVE_RECURSIVE_DELETE',
      title:'Recursive destructive delete instruction',
      category:'destructive_command',
      pattern:/\brm\s+-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*\b|\brm\s+-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*\b|\bRemove-Item\b[^\n]{0,160}\b-Recurse\b[^\n]{0,160}\b-Force\b/i,
      review:'Review target binding, dry-run options and recovery before allowing recursive deletion.'
    }),
    Object.freeze({
      id:'SHELL_EXEC_API',
      title:'Programmatic shell execution primitive referenced',
      category:'command_execution',
      pattern:/\b(?:child_process\.(?:exec|execSync|spawn|spawnSync)|os\.system|subprocess\.(?:run|Popen|call))\b/i,
      review:'Review command construction, argument boundaries and whether shell execution can be removed or constrained.'
    })
  ]);

  const SECRET_PATTERNS = Object.freeze([
    Object.freeze(['PRIVATE_KEY', /-----BEGIN/i]),
    Object.freeze(['OPENAI_STYLE_KEY', /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/]),
    Object.freeze(['GITHUB_CLASSIC_TOKEN', /\bghp_[A-Za-z0-9]{16,}\b/]),
    Object.freeze(['GITHUB_FINE_GRAINED_TOKEN', /\bgithub_pat_[A-Za-z0-9_]{16,}\b/]),
    Object.freeze(['SLACK_TOKEN', /\bxox[a-z]-[A-Za-z0-9-]{12,}\b/i]),
    Object.freeze(['AWS_ACCESS_KEY', /\bAKIA[0-9A-Z]{16}\b/]),
    Object.freeze(['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/]),
    Object.freeze(['LONG_HEX_SECRET', /\b[A-Fa-f0-9]{32,}\b/])
  ]);

  function excerpt(value, max = 220) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + '…';
  }

  function detectSecretLine(line) {
    for (const [id, pattern] of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) return id;
    }
    return null;
  }

  function analyzeConfigText(value) {
    const text = String(value || '');
    const warnings = [];
    const seen = new Set();
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      for (const rule of RULES) {
        rule.pattern.lastIndex = 0;
        if (!rule.pattern.test(line)) continue;
        const key = rule.id + ':' + lineNumber;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push(Object.freeze({
          id:rule.id,
          title:rule.title,
          category:rule.category,
          line:lineNumber,
          excerpt:excerpt(line),
          review:rule.review
        }));
      }

      const secretKind = detectSecretLine(line);
      if (secretKind) {
        const key = 'CREDENTIAL_LITERAL:' + lineNumber;
        if (!seen.has(key)) {
          seen.add(key);
          warnings.push(Object.freeze({
            id:'CREDENTIAL_LITERAL',
            title:'Credential-like literal detected',
            category:'secret_literal',
            line:lineNumber,
            excerpt:'[credential-like value redacted]',
            review:'Remove credential material from instruction files and rotate it if this is a real secret.',
            secret_kind:secretKind
          }));
        }
      }
    });

    return Object.freeze({
      schema:SCHEMA,
      status:'ok',
      mode:'local_static_scan',
      warning_count:warnings.length,
      warnings:Object.freeze(warnings),
      boundary:Object.freeze({
        local_only:true,
        network_requests:0,
        model_calls:0,
        audit_finding:false,
        safety_verdict:false,
        testing_authorization:false
      })
    });
  }

  function textNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function renderWarnings(host, report) {
    host.textContent = '';
    if (!report.warnings.length) {
      const card = document.createElement('article');
      card.className = 'precheck-card';
      card.append(
        textNode('strong', '', 'No configured warning pattern matched.'),
        textNode('p', '', 'That is not a safety verdict or audit result. Review the file and its runtime authority separately.')
      );
      host.appendChild(card);
      return;
    }

    report.warnings.forEach((warning, index) => {
      const card = document.createElement('article');
      card.className = 'precheck-card';
      const head = document.createElement('div');
      head.className = 'precheck-card-head';
      head.append(
        textNode('strong', '', warning.title),
        textNode('span', 'precheck-effect', String(index + 1).padStart(2, '0'))
      );
      const details = document.createElement('dl');
      details.className = 'precheck-dl';
      for (const [label, detail] of [
        ['Rule', warning.id],
        ['Line', String(warning.line)],
        ['Excerpt', warning.excerpt],
        ['Review', warning.review]
      ]) {
        details.append(textNode('dt', '', label), textNode('dd', '', detail));
      }
      card.append(head, details);
      host.appendChild(card);
    });
  }

  function mount(root) {
    const authorityFormPanel = root.querySelector('[data-precheck-authority-form-panel]');
    const authorityResultPanel = root.querySelector('[data-precheck-authority-result-panel]');
    const authorityScopePanel = root.querySelector('[data-precheck-authority-scope-panel]');
    const localFormPanel = root.querySelector('[data-config-scan-form-panel]');
    const localResultPanel = root.querySelector('[data-config-scan-result-panel]');
    const modeButtons = [...root.querySelectorAll('[data-precheck-mode]')];
    const form = root.querySelector('[data-config-scan-form]');
    const input = root.querySelector('[data-config-scan-input]');
    const status = root.querySelector('[data-config-scan-status]');
    const count = root.querySelector('[data-config-scan-count]');
    const warningsHost = root.querySelector('[data-config-scan-warnings]');
    const resultCount = root.querySelector('[data-config-scan-result-count]');
    const copy = root.querySelector('[data-config-scan-copy]');
    const submit = form?.querySelector('[data-js-local-submit]');
    const noJsFallback = form?.querySelector('[data-js-local-fallback]');
    if (!authorityFormPanel || !authorityResultPanel || !authorityScopePanel ||
        !localFormPanel || !localResultPanel || !modeButtons.length ||
        !form || !input || !status || !count || !warningsHost || !resultCount || !copy || !submit || !noJsFallback ||
        form.getAttribute('method') !== 'post' || form.hasAttribute('action')) return;

    let mode = 'authority';
    let report = null;
    let authorityResultWasVisible = !authorityResultPanel.hidden;

    const setMode = next => {
      const target = next === 'config' ? 'config' : 'authority';
      if (mode === 'authority' && target === 'config') {
        authorityResultWasVisible = !authorityResultPanel.hidden;
      }
      mode = target;

      authorityFormPanel.hidden = mode !== 'authority';
      authorityScopePanel.hidden = mode !== 'authority';
      authorityResultPanel.hidden = mode !== 'authority' ? true : !authorityResultWasVisible;
      localFormPanel.hidden = mode !== 'config';
      localResultPanel.hidden = mode !== 'config' || !report;

      modeButtons.forEach(button => {
        const active = button.getAttribute('data-precheck-mode') === mode;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.classList.toggle('button-primary', active);
        button.classList.toggle('button-ghost', !active);
      });
      status.textContent = '';
    };

    modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.getAttribute('data-precheck-mode'))));

    const updateCount = () => {
      count.textContent = input.value.length.toLocaleString('en-US') + ' characters';
    };
    input.addEventListener('input', updateCount);
    updateCount();

    form.addEventListener('submit', event => {
      event.preventDefault();
      const text = input.value;
      if (!text.trim()) {
        report = null;
        localResultPanel.hidden = true;
        status.textContent = 'Paste an instruction or configuration file first.';
        return;
      }

      report = analyzeConfigText(text);
      renderWarnings(warningsHost, report);
      resultCount.textContent = report.warning_count === 1
        ? '1 local warning'
        : report.warning_count + ' local warnings';
      localResultPanel.hidden = false;
      status.textContent = 'Local static scan complete. No network request or model call was made.';
      localResultPanel.scrollIntoView({ behavior:'smooth', block:'start' });
    });

    form.addEventListener('reset', () => {
      report = null;
      requestAnimationFrame(() => {
        localResultPanel.hidden = true;
        status.textContent = '';
        updateCount();
      });
    });

    copy.addEventListener('click', async () => {
      if (!report) return;
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      status.textContent = 'Local scan report copied. No network request was made.';
    });

    setMode('authority');
    noJsFallback.hidden = true;
    submit.disabled = false;
  }

  const TEST_API = Object.freeze({ analyzeConfigText, RULES, SECRET_PATTERNS, SCHEMA });
  if (TEST_MODE) {
    Object.defineProperty(globalThis, '__BITEVO_CONFIG_SCAN_R1_TEST_API__', {
      configurable:true,
      enumerable:false,
      writable:false,
      value:TEST_API
    });
  }

  if (!TEST_MODE && typeof document !== 'undefined') {
    for (const root of document.querySelectorAll('[data-precheck-root]')) mount(root);
  }
})();
