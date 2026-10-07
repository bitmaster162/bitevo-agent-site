(() => {
  const ORDER_TYPES = ['FULL_OPEN', 'PARTIAL_OPEN', 'FULL_RESTRICTED', 'PARTIAL_RESTRICTED', 'CONTRACT'];
  const ITEM_TYPES = ['NATIVE', 'ERC20', 'ERC721', 'ERC1155', 'ERC721_WITH_CRITERIA', 'ERC1155_WITH_CRITERIA'];
  const ZERO_HASH = '0x' + '0'.repeat(64);
  const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
  const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
  const UINT_RE = /^(0|[1-9][0-9]*)$/;

  function enumValue(value, labels, field) {
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value < 0 || value >= labels.length) throw new Error(field + ' is outside the supported enum range');
      return { value, label: labels[value] };
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^[0-9]+$/.test(trimmed)) {
        const n = Number(trimmed);
        if (!Number.isSafeInteger(n) || n < 0 || n >= labels.length) throw new Error(field + ' is outside the supported enum range');
        return { value: n, label: labels[n] };
      }
      const upper = trimmed.toUpperCase();
      const index = labels.indexOf(upper);
      if (index >= 0) return { value: index, label: labels[index] };
    }
    throw new Error(field + ' must be a supported numeric or named enum value');
  }

  function uintString(value, field) {
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(field + ' must be pasted as a decimal string when it exceeds JavaScript safe integer range');
      return String(value);
    }
    if (typeof value === 'string' && UINT_RE.test(value.trim())) return value.trim();
    throw new Error(field + ' must be an unsigned decimal integer');
  }

  function address(value, field) {
    if (typeof value !== 'string' || !ADDRESS_RE.test(value.trim())) throw new Error(field + ' must be a 20-byte 0x address');
    return value.trim();
  }

  function bytes32(value, field) {
    if (typeof value !== 'string' || !BYTES32_RE.test(value.trim())) throw new Error(field + ' must be a 32-byte 0x value');
    return value.trim();
  }

  function item(raw, index, consideration) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error((consideration ? 'consideration' : 'offer') + '[' + index + '] must be an object');
    const itemType = enumValue(raw.itemType, ITEM_TYPES, (consideration ? 'consideration' : 'offer') + '[' + index + '].itemType');
    const out = {
      itemType: itemType.value,
      itemTypeLabel: itemType.label,
      token: address(raw.token, (consideration ? 'consideration' : 'offer') + '[' + index + '].token'),
      identifierOrCriteria: uintString(raw.identifierOrCriteria, (consideration ? 'consideration' : 'offer') + '[' + index + '].identifierOrCriteria'),
      startAmount: uintString(raw.startAmount, (consideration ? 'consideration' : 'offer') + '[' + index + '].startAmount'),
      endAmount: uintString(raw.endAmount, (consideration ? 'consideration' : 'offer') + '[' + index + '].endAmount')
    };
    if (consideration) out.recipient = address(raw.recipient, 'consideration[' + index + '].recipient');
    return out;
  }

  function unwrap(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Top-level JSON must be an object');
    if (raw.protocol_data && raw.protocol_data.parameters) return { ...raw.protocol_data.parameters, counter: raw.protocol_data.parameters.counter ?? raw.counter };
    if (raw.protocolData && raw.protocolData.parameters) return { ...raw.protocolData.parameters, counter: raw.protocolData.parameters.counter ?? raw.counter };
    if (raw.parameters && typeof raw.parameters === 'object') return { ...raw.parameters, counter: raw.parameters.counter ?? raw.counter };
    return raw;
  }

  function isoFromSeconds(value) {
    try {
      const seconds = BigInt(value);
      if (seconds > 8640000000000n) return null;
      const millis = Number(seconds) * 1000;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  }

  function decode(raw) {
    const x = unwrap(raw);
    const required = ['offerer','zone','offer','consideration','orderType','startTime','endTime','zoneHash','salt','conduitKey','counter'];
    for (const key of required) if (x[key] === undefined || x[key] === null) throw new Error('Missing OrderComponents field: ' + key);
    if (!Array.isArray(x.offer) || !Array.isArray(x.consideration)) throw new Error('offer and consideration must be arrays');

    const orderType = enumValue(x.orderType, ORDER_TYPES, 'orderType');
    const startTime = uintString(x.startTime, 'startTime');
    const endTime = uintString(x.endTime, 'endTime');
    const startBig = BigInt(startTime);
    const endBig = BigInt(endTime);
    if (endBig < startBig) throw new Error('endTime must be greater than or equal to startTime');

    const components = {
      offerer: address(x.offerer, 'offerer'),
      zone: address(x.zone, 'zone'),
      offer: x.offer.map((v, i) => item(v, i, false)),
      consideration: x.consideration.map((v, i) => item(v, i, true)),
      orderType: orderType.value,
      orderTypeLabel: orderType.label,
      startTime,
      endTime,
      zoneHash: bytes32(x.zoneHash, 'zoneHash'),
      salt: uintString(x.salt, 'salt'),
      conduitKey: bytes32(x.conduitKey, 'conduitKey'),
      counter: uintString(x.counter, 'counter')
    };

    return {
      schema: 'bitevo.c7.seaport-order-components-decoder/v1',
      localOnly: true,
      can_trade: false,
      networkRequests: 0,
      walletConnect: false,
      signing: false,
      rpcRead: false,
      rpcWrite: false,
      orderSubmit: false,
      cancel: false,
      incrementCounter: false,
      allowanceMutation: false,
      orderHash: 'NOT_COMPUTED',
      components,
      derived: {
        orderType: orderType.label,
        partialFill: orderType.value === 1 || orderType.value === 3,
        restricted: orderType.value === 2 || orderType.value === 3,
        contractOrder: orderType.value === 4,
        offerCount: components.offer.length,
        considerationCount: components.consideration.length,
        startTimeIso: isoFromSeconds(startTime),
        endTimeIso: isoFromSeconds(endTime),
        durationSeconds: String(endBig - startBig),
        conduitMode: components.conduitKey.toLowerCase() === ZERO_HASH ? 'DIRECT_SEAPORT_ZERO_CONDUIT_KEY' : 'CONDUIT_KEY_PRESENT'
      },
      evidenceBoundary: {
        c4_n14: 'BLOCKED_WITHOUT_REAL_AUDITABLE_TX_EVIDENCE',
        transactionEvidenceRepresented: false,
        duneVisibilityVerified: false,
        chainStateVerified: false
      }
    };
  }

  function classifyDune(text) {
    const rows = [];
    for (const raw of text.split(/\r?\n/).map(v => v.trim()).filter(Boolean)) {
      try {
        const url = new URL(raw);
        if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'dune.com') {
          rows.push({ url: raw, kind: 'REJECTED', note: 'Only HTTPS dune.com URLs are accepted.' });
          continue;
        }
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'queries' && /^\d+$/.test(parts[1] || '')) {
          rows.push({ url: url.href, kind: 'PUBLIC_QUERY_CANDIDATE', note: 'URL shape only; public accessibility and results are not fetched or verified.' });
          continue;
        }
        const reserved = new Set(['queries','browse','discover','docs','pricing','blog','terms','privacy','application-terms','sql-api-terms','data-hub']);
        if (parts.length >= 2 && !reserved.has((parts[0] || '').toLowerCase())) {
          rows.push({ url: url.href, kind: 'PUBLIC_DASHBOARD_CANDIDATE', note: 'URL shape only; public accessibility and dashboard contents are not fetched or verified.' });
          continue;
        }
        rows.push({ url: url.href, kind: 'UNRECOGNIZED_DUNE_URL', note: 'Not recognized as a query or dashboard URL shape.' });
      } catch {
        rows.push({ url: raw, kind: 'REJECTED', note: 'Invalid URL.' });
      }
    }
    return rows;
  }

  function setText(root, selector, value) {
    const node = root.querySelector(selector);
    if (node) node.textContent = value == null ? '—' : String(value);
  }

  function init(root) {
    const form = root.querySelector('[data-decoder-form]');
    const orderInput = root.querySelector('[data-order-input]');
    const duneInput = root.querySelector('[data-dune-input]');
    const empty = root.querySelector('[data-decoder-empty]');
    const error = root.querySelector('[data-decoder-error]');
    const output = root.querySelector('[data-decoder-output]');
    const jsonOut = root.querySelector('[data-decoder-json]');
    const duneList = root.querySelector('[data-dune-results]');

    form.addEventListener('submit', event => {
      event.preventDefault();
      error.hidden = true;
      output.hidden = true;
      empty.hidden = true;
      try {
        const report = decode(JSON.parse(orderInput.value));
        const duneEvidence = classifyDune(duneInput.value);
        report.duneEvidence = duneEvidence;

        setText(root, '[data-out-offerer]', report.components.offerer);
        setText(root, '[data-out-zone]', report.components.zone);
        setText(root, '[data-out-order-type]', report.derived.orderType + ' (' + report.components.orderType + ')');
        setText(root, '[data-out-counter]', report.components.counter);
        setText(root, '[data-out-offer-count]', report.derived.offerCount);
        setText(root, '[data-out-consideration-count]', report.derived.considerationCount);
        setText(root, '[data-out-start]', report.derived.startTimeIso || report.components.startTime);
        setText(root, '[data-out-end]', report.derived.endTimeIso || report.components.endTime);
        setText(root, '[data-out-conduit]', report.derived.conduitMode);
        jsonOut.textContent = JSON.stringify(report, null, 2);

        duneList.replaceChildren();
        if (!duneEvidence.length) {
          const li = document.createElement('li');
          li.textContent = root.dataset.duneEmpty || 'No Dune URLs supplied.';
          duneList.append(li);
        } else {
          for (const row of duneEvidence) {
            const li = document.createElement('li');
            li.textContent = row.kind + ' · ' + row.url + ' · ' + row.note;
            duneList.append(li);
          }
        }
        output.hidden = false;
      } catch (cause) {
        error.textContent = (root.dataset.errorLabel || 'Decode failed.') + ' ' + (cause instanceof Error ? cause.message : String(cause));
        error.hidden = false;
      }
    });

    form.addEventListener('reset', () => {
      setTimeout(() => {
        empty.hidden = false;
        error.hidden = true;
        output.hidden = true;
        error.textContent = '';
        jsonOut.textContent = '';
        duneList.replaceChildren();
      }, 0);
    });
  }

  document.querySelectorAll('[data-seaport-decoder]').forEach(init);
})();
