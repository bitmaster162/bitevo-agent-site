export async function GET() {
	const guides = [
  {
    "id": "mem-arena-regime-playbook-018",
    "type": "strategy",
    "human_title": "Regime Playbook: что торговать в каждом режиме BTC",
    "agent_summary": "Edge is signal x direction x REGIME, not signal alone. Live 7d matrix: green cells +$4457, same signals in wrong regimes -$25452. Playbook: up_mild -> buy dips (candle_reversal long, best cell +$1547). up_strong -> bos both directions (short fades exhaustion +$1027, long rides). flat -> grid only (directional bleeds). down_mild -> grid or flat. down_strong -> trend-following short on breakdown (bos short +$493), never catch knives (candle_reversal long -$2559). Implementation: gate each signal:direction by regime, block red cells, keep green. Not static signal on/off but regime-conditional.",
    "tags": [
      "trading",
      "regime",
      "playbook",
      "what",
      "to",
      "trade"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "green_pnl_7d": 4457,
        "red_pnl_7d": -25452
      }
    },
    "safety_guards": [
      {
        "rule": "block_signal_dir_in_red_regime",
        "max_limit": 0,
        "action_on_breach": "abstain"
      }
    ]
  },
  {
    "id": "mem-sbor-ai-agent-trust-layer-rel",
    "type": "strategy",
    "human_title": "AI-Agent Trust Layer: надёжность агентов как продукт",
    "agent_summary": "Trust Layer между LLM и средой: threat model агентов = чек-лист аудита надёжности.",
    "tags": [
      "ai",
      "ai",
      "agent",
      "trust",
      "layer",
      "reliability"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-sbor-blockchain-forensics-onc",
    "type": "strategy",
    "human_title": "Blockchain-форензика: методология ончейн-расследований",
    "agent_summary": "Ончейн-форензика: gas trail, Sybil-фермы, идентификация контрактов — продаваемый OSINT-сервис.",
    "tags": [
      "security",
      "blockchain",
      "forensics",
      "onchain",
      "investigations"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-arena-s15-compression",
    "type": "strategy",
    "human_title": "S15: Паттерн «Compression / No-Man’s-Land» (Сжатие и Капкан-удушение)",
    "agent_summary": "Volatility compression and mid-range trap (no man's land): when ATR percent is compressed below the floor and price is in the middle of local swing range (30% to 70%), reject entries. These zones are high-risk chop. Entry only allowed on breakout (with 2x volume confirm) or after sweep/V-reversal at range extremes.",
    "tags": [
      "trading",
      "compression",
      "no",
      "mans",
      "land",
      "trap"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "atr_compression_lookback": 14,
        "mid_range_min_pct": 30,
        "mid_range_max_pct": 70,
        "breakout_vol_multiplier": 2
      }
    },
    "safety_guards": [
      {
        "rule": "reject_mid_range_compression",
        "max_limit": 0,
        "action_on_breach": "reject"
      }
    ]
  },
  {
    "id": "mem-sbor-grid-trading-os-institut",
    "type": "strategy",
    "human_title": "Grid Trading OS — институциональная спецификация (2026)",
    "agent_summary": "ATR-калибровка шага, fee-firewall, ±3σ range, GER soft-stop, regime switching — институциональная грид-спека.",
    "tags": [
      "trading",
      "grid",
      "trading",
      "os",
      "institutional",
      "spec"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-sbor-microstructure-delisting",
    "type": "strategy",
    "human_title": "Микроструктура и риск делистинга 2026: data-integrity для квант-движка",
    "agent_summary": "Bybit unilateral-OI (11.06.2026) ломает бэктесты; Delist-Risk Score для авто-флага токсичных активов.",
    "tags": [
      "trading",
      "microstructure",
      "delisting",
      "data",
      "integrity",
      "2026"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-sbor-monetization-matrix-4x3",
    "type": "strategy",
    "human_title": "Матрица монетизации: от быстрых денег к инфраструктуре",
    "agent_summary": "Матрица 4 уровня × 3 горизонта: быстрые деньги финансируют moonshots, anti-кассовый-разрыв.",
    "tags": [
      "business",
      "monetization",
      "matrix",
      "4x3"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-sbor-multiagent-orchestration",
    "type": "strategy",
    "human_title": "Мультиагентная оркестрация и автономное исследование",
    "agent_summary": "Граф-оркестрация, test-time compute, Arbiter/Clarifier; арена как автономная исследовательская система.",
    "tags": [
      "ai",
      "multiagent",
      "orchestration",
      "autonomous",
      "research"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-arena-s14-fake-crown",
    "type": "strategy",
    "human_title": "S14: Паттерн «Один говорит, а три молчат» (Фейковая корона)",
    "agent_summary": "Sector divergence filter (fake crown): when 1 asset in a correlated sector (e.g. L2: ARB, OP, MANTA, STRK) pumps but peers are silent (no sector confirmation), reject trading signals on the leader. Rule: price increase of leader over last 5 intervals without peer response is treated as a trap. Filter checks peer price changes and rejects if peer change is below threshold.",
    "tags": [
      "trading",
      "sector",
      "divergence",
      "fake",
      "crown"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "sector_peers": [
          "ARB",
          "OP",
          "MANTA",
          "STRK"
        ],
        "lookback_intervals": 5,
        "divergence_threshold_pct": 1.5
      }
    },
    "safety_guards": [
      {
        "rule": "reject_sector_divergence",
        "max_limit": 0,
        "action_on_breach": "reject"
      }
    ]
  },
  {
    "id": "mem-sbor-survival-math-ergodicity",
    "type": "strategy",
    "human_title": "Математика выживания: эргодичность, Келли и expectancy",
    "agent_summary": "Эргодичность, Келли, expectancy: почему +EV может банкротить и как судить ботов по геом. росту.",
    "tags": [
      "risk",
      "survival",
      "math",
      "ergodicity",
      "kelly"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-sbor-trading-discipline-journ",
    "type": "strategy",
    "human_title": "Дисциплина трейдинга: дневник, MAE/MFE и психология убытков",
    "agent_summary": "Дневник, MAE/MFE-калибровка стопов/тейков, эффект диспозиции и как не зашить его в код.",
    "tags": [
      "trading",
      "trading",
      "discipline",
      "journal",
      "mae",
      "mfe"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-trn-psy-010",
    "type": "strategy",
    "human_title": "S10: Системы Внимания и контр-индикаторы «Анти-Я»",
    "agent_summary": "Trading attention control system. Detail anchors (mental, somatic, technical, social). Monitor Chlenikus Human Index (CHI > 1.2). Execute reverse tilt trades (opposite of tiltrun) to capture edge from raw losses.",
    "tags": [
      "trading",
      "anti",
      "self",
      "attention",
      "trading",
      "psychology"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_chi_limit": 1.2,
        "breath_pattern": "4-4-4",
        "rule_1_candle_wait_sec": 60
      }
    },
    "safety_guards": [
      {
        "rule": "anti_self_reverse_trigger",
        "max_limit": 1.2,
        "action_on_breach": "execute_opposite_order"
      }
    ]
  },
  {
    "id": "mem-trn-ali-009",
    "type": "strategy",
    "human_title": "Data Alignment: Правила подтверждения свечей и синхронизация",
    "agent_summary": "Trading loop alignment specifications. Enforce candle close confirmation by using df.iloc[-2] instead of df.iloc[-1]. Implement historical scan window to process missed bars between cycles. Set minimum trailing stop distance relative to ATR.",
    "tags": [
      "infrastructure",
      "candle",
      "confirmation",
      "data",
      "alignment"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "require_closed_bar": true,
        "backfill_lookback_bars": 10,
        "min_trailing_stop_atr_multiplier": 1.5
      }
    },
    "safety_guards": [
      {
        "rule": "confirm_closed_bar",
        "max_limit": 1,
        "action_on_breach": "skip_entry"
      }
    ]
  },
  {
    "id": "mem-arena-crowd-007",
    "type": "strategy",
    "human_title": "Crowd-fade: как читать long/short ratio фьючерсов и торговать против толпы",
    "agent_summary": "Crowd-fade strategy: Binance futures long/short account ratio (retail) vs top-trader position ratio (smart money). When retail L/S extreme (>2.5) and top-traders neutral (<1.6) = divergence = fade-the-crowd short candidate. Data from fapi globalLongShortAccountRatio + topLongShortPositionRatio. Not standalone signal, confirmation filter.",
    "tags": [
      "trading",
      "crowd",
      "fade",
      "long",
      "short",
      "ratio"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [
        "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
      ],
      "constants": {
        "retail_extreme": 2.5,
        "smart_neutral": 1.6
      }
    },
    "safety_guards": [
      {
        "rule": "not_standalone_entry",
        "max_limit": 0,
        "action_on_breach": "confirm_only"
      }
    ]
  },
  {
    "id": "mem-arena-divers-010",
    "type": "strategy",
    "human_title": "Иллюзия диверсификации: почему 150 ботов — это часто 1 стратегия в 150 копиях",
    "agent_summary": "Diversification illusion: 150 bots running variations of ONE engine = correlation ~1, not 150 independent edges. When engine out of phase with market, all lose together (one day -15k). More parametrizations of one idea does not change expectancy. Real diversification needs uncorrelated strategies (different signal logic, not different params). Lesson from 71k trades.",
    "tags": [
      "trading",
      "diversification",
      "illusion",
      "bots"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "bots": 150,
        "correlation": 1
      }
    },
    "safety_guards": [
      {
        "rule": "count_independent_edges_not_bots",
        "max_limit": 0,
        "action_on_breach": "reject"
      }
    ]
  },
  {
    "id": "mem-gov-flt-011",
    "type": "specification",
    "human_title": "D11: Fleet Coordinator и технический дрейф",
    "agent_summary": "Fleet Coordinator protocol. Reconcile fleet servers (arena-vps, win185, fin35, old144) and agents state against fleet_registry.json. Detect and log technical drifts D1-D8, output unified_state.json and unified_state.js, and post audit trail observations to BitEvo API.",
    "tags": [
      "governance",
      "fleet",
      "coordinator",
      "drift",
      "monitoring"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [
        "http://localhost:8080/journal/entries"
      ],
      "constants": {
        "fleet_check_interval_minutes": 15,
        "hosts_count": 4,
        "drift_rules_count": 8,
        "state_output_file": "fleet/unified_state.json"
      }
    },
    "safety_guards": [
      {
        "rule": "connectivity_guard_isolated_failures",
        "max_limit": 1,
        "action_on_breach": "set_unknown"
      },
      {
        "rule": "zero_secrets_leaked_check",
        "max_limit": 0,
        "action_on_breach": "block_write"
      }
    ]
  },
  {
    "id": "mem-trn-frc-012",
    "type": "strategy",
    "human_title": "S12: Фрактальный интеллект: Роли внимания, Q-score и AutoDigest",
    "agent_summary": "Enforce fractal attention network roles in trading workflows. Assign distinct duties to Scout (setup hunting), Scribe (journaling & digests), Mirror (reflection), Anchor (operator constraints), and Sentinel (limits & anti-self). Calculate setup Q-score (Q = 0.45*Edge + 0.25*Timing + 0.20*Consensus + 0.10*Discipline). Apply 1R/0.5R risk limits and 10-15m cool-down rule.",
    "tags": [
      "trading",
      "fractal",
      "intelligence",
      "scouts",
      "scribes",
      "attention"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "q_score_min_threshold": 0.75,
        "default_risk_units": 1,
        "defensive_risk_units": 0.5,
        "cooldown_minutes": 15
      }
    },
    "safety_guards": [
      {
        "rule": "minimum_q_score_requirement",
        "max_limit": 0.75,
        "action_on_breach": "veto_trade"
      },
      {
        "rule": "enforce_cooldown_period",
        "max_limit": 15,
        "action_on_breach": "block_new_orders"
      }
    ]
  },
  {
    "id": "mem-trn-grd-011",
    "type": "strategy",
    "human_title": "S11: Сеточные боты и управление выходом из диапазона (Recentering)",
    "agent_summary": "Grid trading bot workflow and parameters. Optimize grid levels under market volatility. Enforce unit economics (unit profit > fee). Apply stop-loss below range low and recentering (Stop & Rebuild) or expansion strategies upon breakout.",
    "tags": [
      "trading",
      "grid",
      "trading",
      "breakout",
      "recentering",
      "management"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "min_grid_levels": 10,
        "max_grid_levels": 50,
        "min_step_pct": 0.5,
        "leverage_limit": 3
      }
    },
    "safety_guards": [
      {
        "rule": "unit_economics_check",
        "max_limit": 1,
        "action_on_breach": "reject_parameters"
      },
      {
        "rule": "stop_loss_required",
        "max_limit": 1,
        "action_on_breach": "cancel_startup"
      }
    ]
  },
  {
    "id": "mem-arena-valid-008",
    "type": "strategy",
    "human_title": "Как проверить торговый эдж по-честному: OOS, bootstrap CI и почему in-sample врёт",
    "agent_summary": "Edge validation method: (1) time-split 70/30, edge must hold out-of-sample not just in-sample. (2) bootstrap 5000 resamples for 90% CI of expectancy - if CI includes zero, no edge. (3) min 100 trades, 10 days, 3 regimes. (4) beat 3 benchmarks: buy&hold, random entry same R:R, inverted signal. Example: full portfolio looked +4.26/tr in-sample but -2.66 OOS = curve-fit, rejected. Only edges passing all survive.",
    "tags": [
      "trading",
      "how",
      "to",
      "validate",
      "edge",
      "oos",
      "bootstrap"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "min_trades": 100,
        "min_days": 10,
        "oos_split": 0.7,
        "bootstrap_n": 5000
      }
    },
    "safety_guards": [
      {
        "rule": "reject_if_CI_includes_zero",
        "max_limit": 0,
        "action_on_breach": "reject"
      }
    ]
  },
  {
    "id": "mem-trn-rel-016",
    "type": "strategy",
    "human_title": "S13: Макро-режимы ликвидности и ETH-BTC Relativity Gap",
    "agent_summary": "Analyze ETH/BTC relative value under various macro-liquidity regimes. Monitor effective Fed rate, Broad DXY index, and Federal Reserve reserve management purchases ($40B/mo short bills). Enforce ETH-Core protocol: accumulate ETH as primary asset only if price > SMA200 OR 30-day momentum > 1.15; otherwise, treat ETH positions as hedge with reduced exposure. Implement par-hedging via long-ETH/short-BTC setups to mitigate systemic risk-off deleveraging ($2.56B liquidation cascades).",
    "tags": [
      "trading",
      "macro",
      "liquidity",
      "eth",
      "btc",
      "relativity",
      "gap"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "effective_fed_rate_pct": 3.64,
        "dxy_index": 118.24,
        "eth_btc_relative_floor": 0.029,
        "momentum_threshold": 1.15
      }
    },
    "safety_guards": [
      {
        "rule": "eth_core_regime_check",
        "max_limit": 1.15,
        "action_on_breach": "reduce_risk"
      },
      {
        "rule": "pair_hedging_required",
        "max_limit": 1,
        "action_on_breach": "force_neutral"
      }
    ]
  },
  {
    "id": "mem-mas-coev-013",
    "type": "specification",
    "human_title": "D13: Управляемая коэволюция и изоляция многоагентных систем (MAS)",
    "agent_summary": "Enforce safety protocols in multi-agent environments. Implement a deterministic Policy Gate to filter agent actions, limit access keys, sandbox browser/tool runs (Firecracker, gVisor, or seccomp), and prevent emergent behavior and prompts poisoning (OWASP GenAI Top 10). Maintain audit log.",
    "tags": [
      "security",
      "mas",
      "managed",
      "coevolution",
      "sandbox",
      "isolation"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_consecutive_errors": 3,
        "max_tool_execution_time_sec": 30,
        "sandbox_type": "gVisor"
      }
    },
    "safety_guards": [
      {
        "rule": "require_human_approval_for_destructive_actions",
        "max_limit": 1,
        "action_on_breach": "halt"
      },
      {
        "rule": "max_execution_duration",
        "max_limit": 30,
        "action_on_breach": "kill_process"
      }
    ]
  },
  {
    "id": "mem-arena-mild-005",
    "type": "strategy",
    "human_title": "Парадокс mild-тренда: почему развороты работают в слабом тренде и сливают в сильном",
    "agent_summary": "Reversal signals (candle_reversal) profit in MILD trends (+8599) but lose in STRONG trends (-2923) on 1450 trades. Reason: in mild trend a reversal catches the pullback in trend direction; in strong trend it fights momentum. Filter: trade reversals only in mild regimes, abstain in strong.",
    "tags": [
      "trading",
      "mild",
      "vs",
      "strong",
      "trend",
      "reversal"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "mild_net": 8599,
        "strong_net": -2923
      }
    },
    "safety_guards": [
      {
        "rule": "no_reversal_in_strong_trend",
        "max_limit": 0,
        "action_on_breach": "abstain"
      }
    ]
  },
  {
    "id": "mem-core-cmp-012",
    "type": "specification",
    "human_title": "D12: MirrorCore++ и сжатие памяти по самосогласованности",
    "agent_summary": "MirrorCore++ and CompactDigest memory compression. Vectorize and score chat consistency. Enforce identity kernel thresholds (score >= 0.92, tone drift <= 1.5%), cluster chunks (DBSCAN), and trigger delta-digest writes (>1.5MB per 12h).",
    "tags": [
      "security",
      "mirrorcore",
      "compactdigest",
      "memory",
      "compression"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "inclusion_score": 0.92,
        "max_drift_percent": 1.5,
        "compact_digest_threshold_mb": 1.5,
        "compact_digest_period_hours": 12
      }
    },
    "safety_guards": [
      {
        "rule": "enforce_min_consistency_score",
        "max_limit": 0.92,
        "action_on_breach": "exclude_from_kernel"
      }
    ]
  },
  {
    "id": "mem-inf-arb-015",
    "type": "specification",
    "human_title": "D15: MultiGPT-Bridge и Федеративный ИИ-Арбитраж",
    "agent_summary": "Deploy a federated AI agent arbitration pipeline. Use MultiGPT-Bridge for context alignment and payload routing. Enforce AnchorSet initializations for external worker nodes (GPT-4o, Claude 3.5 Sonnet, Gemini Pro). Deploy a Meta-LLM Aggregator with Mixture-of-Agents (MoA) consensus evaluated by a centralized Digital Arbiter. Keep Self-Consistency Score Q >= 0.92, drift <= 1.5%, and trigger compression at 1.5MB text bytes.",
    "tags": [
      "infrastructure",
      "multigpt",
      "bridge",
      "federated",
      "ai",
      "arbitration"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Memory Bridge Controller",
          "address": "0x4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/evidence/link",
        "http://localhost:8080/search/hybrid"
      ],
      "constants": {
        "min_q_score_threshold": 0.92,
        "max_drift_allowed": 0.015,
        "new_text_bytes_trigger": 1572864
      }
    },
    "safety_guards": [
      {
        "rule": "enforce_identity_lock",
        "max_limit": 1,
        "action_on_breach": "abort_call"
      },
      {
        "rule": "enforce_q_score",
        "max_limit": 0.92,
        "action_on_breach": "regenerate"
      }
    ]
  },
  {
    "id": "mem-inf-pgb-010",
    "type": "specification",
    "human_title": "PostgreSQL Backup Daemon: Автоматическая синхронизация бэкапов",
    "agent_summary": "PostgreSQL backup sync daemon. Verify container health, execute pg_dump via docker exec, compress output with gzip, store in Server backup directory, rotate old files (keep 10), and write statuses to postgres_backup_history.jsonl and proof_ledger.jsonl.",
    "tags": [
      "infrastructure",
      "postgres",
      "backup",
      "sync",
      "daemon"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "backup_retention_count": 10,
        "backup_interval_hours": 24,
        "backup_dir": "C:/Users/coins/My Drive/Server backup/postgres_backups",
        "container_name": "bitevo_postgres"
      }
    },
    "safety_guards": [
      {
        "rule": "verify_container_running",
        "max_limit": 1,
        "action_on_breach": "start_container"
      },
      {
        "rule": "backup_file_min_size_kb",
        "max_limit": 1024,
        "action_on_breach": "alert_operator"
      }
    ]
  },
  {
    "id": "mem-arena-regtime-009",
    "type": "strategy",
    "human_title": "Тайминг регима: входить через 30-120 минут после смены тренда",
    "agent_summary": "Regime-age timing: entry 30-120min after regime change has exp +14.88/trade, but 2-6h into regime = -2.93 (dead zone), 0-30min = +4.11 (too early/noisy), 6h+ = +9.25. Sweet spot: regime established but not exhausted. Track regime transitions, gate entries by regime-age.",
    "tags": [
      "trading",
      "regime",
      "timing",
      "30",
      "120",
      "min"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "sweet_min": 30,
        "sweet_max": 120
      }
    },
    "safety_guards": [
      {
        "rule": "avoid_mid_regime_entry",
        "max_limit": 0,
        "action_on_breach": "abstain"
      }
    ]
  },
  {
    "id": "mem-trn-drw-008",
    "type": "strategy",
    "human_title": "Sovereign Scalper: Глубокий анализ просадки",
    "agent_summary": "Sovereign Core drawdown audit. Identify 5 root causes: incomplete candle execution (df.iloc[-1]), sampling miss (interval desync), 0.3% trailing stop hyper-sensitivity, 1% capped swing stop loss, and legacy startup cleanup (0 PnL closes). Recommend mitigation steps.",
    "tags": [
      "trading",
      "sovereign",
      "scalper",
      "drawdown",
      "analysis"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "starting_capital": 1000,
        "total_trades_analyzed": 1494,
        "win_rate_percent": 22.69,
        "net_loss_usd": -1708.61,
        "profit_factor": 0.75
      }
    },
    "safety_guards": [
      {
        "rule": "max_drawdown_stop",
        "max_limit": 500,
        "action_on_breach": "halt_trading"
      }
    ]
  },
  {
    "id": "mem-infra-mon-014",
    "type": "specification",
    "human_title": "D14: Системы мониторинга торговой эффективности: Архитектура SSOT и ИИ-коучинг",
    "agent_summary": "Design trader performance monitoring dashboards. Build a Single Source of Truth (SSOT) to aggregate and normalize trades (Binance API, MetaTrader parser, IB SDK). Compare TraderSync (AI Cypher Q&A), Tradervue (Mentor View read-only access), and TradeZella (Spaces, Playbook strategy tracking). Implement real-time risk breach alerts and behavioral diagnostics (revenge-trading and overtrading detectors).",
    "tags": [
      "security",
      "trading",
      "performance",
      "monitoring",
      "ssot",
      "ai"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_students_per_space": 5,
        "real_time_latency_ms": 1000,
        "database_type": "PostgreSQL"
      }
    },
    "safety_guards": [
      {
        "rule": "alert_on_revenge_trading",
        "max_limit": 1,
        "action_on_breach": "flag_account_suspend_trading"
      },
      {
        "rule": "unauthorized_write_block",
        "max_limit": 1,
        "action_on_breach": "revoke_api_key"
      }
    ]
  },
  {
    "id": "mem-arena-rmath-006",
    "type": "strategy",
    "human_title": "Как 50% winrate приносит прибыль: математика R-кратности в трендследовании",
    "agent_summary": "Trend-following math: avg TP +77.52 vs avg SL -8.01 = 6.8x asymmetry. Only 18% hit TP but winners are 6.8x losers so net positive. Expectancy = WR*avg_win - (1-WR)*avg_loss after costs. Cut losers fast, let winners run. WR alone is meaningless; expectancy in R-multiples is what matters.",
    "tags": [
      "trading",
      "trend",
      "following",
      "r",
      "multiple",
      "math"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "avg_tp": 77.52,
        "avg_sl": -8.01,
        "tp_hit_rate": 0.18
      }
    },
    "safety_guards": [
      {
        "rule": "measure_expectancy_not_winrate",
        "max_limit": 0,
        "action_on_breach": "reject"
      }
    ]
  },
  {
    "id": "svc-ai-audit-001",
    "type": "strategy",
    "human_title": "AI-Agent Reliability Audit — за 72 часа делаю ваших агентов безопасными",
    "agent_summary": "AI-Agent Reliability Audit service. Problem: production AI agents hallucinate, get prompt-injected, no rollback. Gartner: 40% will disable autonomous agents by 2027. Deliverable: agent capability/permission map, injection stress-test, Decision Trace logging, instant Rollback module, safety policy. Tiered pricing: free diagnostic call -> $500-1500 mini-audit -> $3-5k full 72h -> $12500 enterprise. Built on proven components: Acceptor Loop (decision trace), anti-self veto (rollback gate), HOT-3 Belief Dominance (uncertainty measurement), sovereign local architecture (no data leak).",
    "tags": [
      "service",
      "ai",
      "agent",
      "reliability",
      "audit"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "diagnostic_price_usd": 0,
        "mini_audit_usd": 1000,
        "full_audit_usd": 4000,
        "enterprise_usd": 12500,
        "audit_hours": 72
      }
    },
    "safety_guards": [
      {
        "rule": "rollback_module_required",
        "max_limit": 1,
        "action_on_breach": "block_deploy"
      }
    ]
  },
  {
    "id": "mem-arena-risk-004",
    "type": "strategy",
    "human_title": "Как читать риск рынка за 60 секунд: FNG + funding + режим",
    "agent_summary": "Read market risk fast using 3 free signals. Fear&Greed extremes (<=15 capitulation, >=80 euphoria), funding rate extremes (|fr|>0.05% = positioning imbalance, liquidation cascade risk), regime shift (trend vs flat). Combine: extreme fear + high positive funding = longs overheated into weakness = high cascade risk. Action is risk-reduction, not entry signals.",
    "tags": [
      "trading",
      "read",
      "market",
      "risk",
      "fng",
      "funding"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "fng_fear": 15,
        "fng_greed": 80,
        "funding_extreme_pct": 0.05,
        "vol_high_pct": 3
      }
    },
    "safety_guards": [
      {
        "rule": "no_add_in_overheated_direction",
        "max_limit": 0,
        "action_on_breach": "block"
      }
    ]
  },
  {
    "id": "mem-arena-edge-003",
    "type": "strategy",
    "human_title": "Почему 90% paper-trading стратегий теряют: 3 механических дефекта на 66k сделок",
    "agent_summary": "Three mechanical defects that kill trading strategies, proven on 66k live paper trades. 1) Dead coins: sub-cent alts (DOGE/PENGU/SEI) lose even on TP-close because fees+spread exceed price move. 2) R:R geometry: SL~=TP size but 2.3x more stops => guaranteed bleed below 50% WR. 3) Indicator theatre: ML filter initialized but predict() never called. Validation rule: min 100 trades, 10 days, 3 regimes, measure expectancy after costs, beat buy&hold + random + inverted.",
    "tags": [
      "trading",
      "why",
      "90",
      "percent",
      "strategies",
      "lose"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "min_sample_trades": 100,
        "min_distinct_days": 10,
        "min_regimes": 3,
        "required_rr_below_50wr": 2.5
      }
    },
    "safety_guards": [
      {
        "rule": "cost_to_move_ratio",
        "max_limit": 0.33,
        "action_on_breach": "reject_instrument"
      },
      {
        "rule": "expectancy_after_costs",
        "max_limit": 0,
        "action_on_breach": "kill_strategy"
      }
    ]
  },
  {
    "id": "mem-core-arc-008",
    "type": "specification",
    "human_title": "ArchiveOS & MultiGPT-Bridge: Потоки памяти и арбитраж ИИ",
    "agent_summary": "Manage AI agent memory and context stream. Enforce AnchorSet identity transfer, federated MultiGPT-Bridge routing, and Meta-LLM Aggregator arbitration. Track API queries to hybrid search, offset-read conversations, and evidence linking.",
    "tags": [
      "infrastructure",
      "archiveos",
      "multigpt",
      "bridge",
      "integration"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Memory Bridge Controller",
          "address": "0x4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/evidence/link",
        "http://localhost:8080/search/hybrid"
      ],
      "constants": {
        "min_q_score_threshold": 0.92,
        "max_drift_allowed": 0.015
      }
    },
    "safety_guards": [
      {
        "rule": "enforce_identity_lock",
        "max_limit": 1,
        "action_on_breach": "abort_call"
      },
      {
        "rule": "enforce_q_score",
        "max_limit": 0.92,
        "action_on_breach": "regenerate"
      }
    ]
  },
  {
    "id": "mem-sec-d3-003",
    "type": "specification",
    "human_title": "D3: Tool-IO Bridge Спецификация и Контракт",
    "agent_summary": "D3 Tool-IO Bridge. Restrict shell command execution and script runs. Enforce strict whitelist policy, sandbox limits, timeout constraints, token budget checks, and scheme expectancy matching.",
    "tags": [
      "security",
      "d3",
      "tool",
      "io",
      "bridge",
      "contract"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Tool-IO Gate",
          "address": "0x3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/console/execute"
      ],
      "constants": {
        "sandbox_enabled": true,
        "execution_timeout_seconds": 30,
        "max_token_budget_per_call": 2000
      }
    },
    "safety_guards": [
      {
        "rule": "sandbox_on",
        "max_limit": 1,
        "action_on_breach": "abort"
      },
      {
        "rule": "call_timeout_seconds",
        "max_limit": 30,
        "action_on_breach": "abort"
      }
    ]
  },
  {
    "id": "mem-eth-btc-gap-005",
    "type": "strategy",
    "human_title": "ETH-BTC Relativity Gap: Торговля относительной силой и макро-индикаторы",
    "agent_summary": "Monitor ETH/BTC relative price gap and macro regime shifts. Track Federal Reserve effective rate (FOMC target), US Dollar Index (DXY), and liquidated leverage. Execute hedging via long ETH / short BTC in equal delta. Parameters: leverage threshold, target ETH/BTC ratio.",
    "tags": [
      "trading",
      "eth",
      "btc",
      "relativity",
      "gap"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [
        "https://api.binance.com/api/v3/klines"
      ],
      "constants": {
        "fomc_rate_target_range": [
          3.5,
          3.75
        ],
        "nominal_broad_usd_index_baseline": 118.24,
        "min_eth_btc_ratio_for_core_holding": 0.0294
      }
    },
    "safety_guards": [
      {
        "rule": "max_liquidated_leverage_usd_billions",
        "max_limit": 2.56,
        "action_on_breach": "cooldown_6h"
      },
      {
        "rule": "max_hedging_delta_deviation",
        "max_limit": 5,
        "action_on_breach": "rebalance_deltas"
      }
    ]
  },
  {
    "id": "mem-evm-safety-003",
    "type": "strategy",
    "human_title": "EVM: Безопасность аппрувов и защита от фронтраннинга через Flashbots",
    "agent_summary": "Verify and protect EVM transactions. Prevent frontrunning/sandwiching by routing transaction bundles directly to Flashbots builder RPC. Limit infinite approvals and configure automatic allowances revoking. Parameters: relay RPC endpoint, maximum gas limit, allowance thresholds.",
    "tags": [
      "security",
      "evm",
      "approval",
      "safety",
      "flashbots"
    ],
    "params": {
      "contracts": [
        {
          "name": "Uniswap V3 SwapRouter",
          "address": "0xE592427A0AECE92DE3EDEE1F18E0157C05861564",
          "chain": "eth"
        }
      ],
      "rpc_endpoints": [
        "https://relay.flashbots.net"
      ],
      "constants": {
        "max_gas_price_gwei": 120,
        "default_approval_amount": 1000
      }
    },
    "safety_guards": [
      {
        "rule": "max_gas_price_gwei",
        "max_limit": 120,
        "action_on_breach": "abort"
      },
      {
        "rule": "infinite_approval_block",
        "max_limit": 1,
        "action_on_breach": "enforce_exact_amount"
      }
    ]
  },
  {
    "id": "mem-core-seed-006",
    "type": "safety_guard",
    "human_title": "MirrorCore & Seeding: Техника переноса и устойчивости контекста ИИ",
    "agent_summary": "Enforce identity locks and restore agent states using seed capsules. Implement IdentityLock verification parameters, antiloop thresholds, and idempotency key checks (Time@BKK + content hash).",
    "tags": [
      "security",
      "mirrorcore",
      "seeding",
      "identity",
      "persistence"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "drift_threshold_percent": 2,
        "max_latency_ms": 10
      }
    },
    "safety_guards": [
      {
        "rule": "identity_lock_required",
        "max_limit": 1,
        "action_on_breach": "abort_execution"
      },
      {
        "rule": "idempotency_check",
        "max_limit": 1,
        "action_on_breach": "skip_write"
      }
    ]
  },
  {
    "id": "mem-mas-safety-004",
    "type": "safety_guard",
    "human_title": "Управляемая коэволюция и безопасность многоагентных систем (MAS)",
    "agent_summary": "Enforce safety protocols in multi-agent environments. Implement a deterministic Policy Gate to filter agent actions, limit access keys, sandbox browser/tool runs (Firecracker, gVisor, or seccomp), and prevent emergent behavior and prompts poisoning (OWASP GenAI Top 10). Maintain audit log.",
    "tags": [
      "security",
      "multi",
      "agent",
      "system",
      "safety"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_consecutive_errors": 3,
        "max_tool_execution_time_sec": 30,
        "sandbox_type": "gVisor"
      }
    },
    "safety_guards": [
      {
        "rule": "require_human_approval_for_destructive_actions",
        "max_limit": 1,
        "action_on_breach": "halt"
      },
      {
        "rule": "max_execution_duration",
        "max_limit": 30,
        "action_on_breach": "kill_process"
      }
    ]
  },
  {
    "id": "mem-loop-preserve-007",
    "type": "protocol",
    "human_title": "Omni Core Loop & Self-Preservation: Детерминированные фоновые циклы автономии",
    "agent_summary": "Orchestrate autonomous agent behaviors in looping environments. Monitor drift, latency, and load metrics using a Watchdog. Apply DriftGuard correction and schedule ColdBackups of system states.",
    "tags": [
      "automation",
      "omnicore",
      "loop",
      "self",
      "preservation"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "loop_interval_minutes": 15,
        "backup_interval_hours": 1
      }
    },
    "safety_guards": [
      {
        "rule": "max_drift_before_recovery",
        "max_limit": 3,
        "action_on_breach": "revert_state"
      },
      {
        "rule": "max_load_before_cooldown",
        "max_limit": 8,
        "action_on_breach": "pause_loop"
      }
    ]
  },
  {
    "id": "mem-aut-ref-005",
    "type": "specification",
    "human_title": "Reflex Layer: Автономный OODA-мониторинг",
    "agent_summary": "Reflex layer OODA monitoring. Run 60-second heartbeat check on /health. Automatically rotate logs if size exceeds threshold. Handle fail-closed overrides.",
    "tags": [
      "automation",
      "reflex",
      "layer",
      "ooda",
      "monitoring"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Reflex Guardian",
          "address": "0xREFLEXFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/health"
      ],
      "constants": {
        "heartbeat_interval_seconds": 60,
        "max_log_size_bytes": 10485760
      }
    },
    "safety_guards": [
      {
        "rule": "max_log_size_bytes",
        "max_limit": 10485760,
        "action_on_breach": "rotate"
      },
      {
        "rule": "operator_override_allowed",
        "max_limit": 1,
        "action_on_breach": "force_allow"
      }
    ]
  },
  {
    "id": "mem-gov-sap-004",
    "type": "specification",
    "human_title": "State Authority Plane: Управление привилегиями агентов",
    "agent_summary": "State Authority Plane governance. Enforce capability passport validation across Loop A, B, and C. Validate operator authority gates before promoting any state updates.",
    "tags": [
      "governance",
      "state",
      "authority",
      "plane",
      "evolution"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Capability Passports Registry",
          "address": "0xSAP1111111111111111111111111111111111111",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/continuity/sync"
      ],
      "constants": {
        "min_authority_level_required": "D2",
        "operator_id": 932299051
      }
    },
    "safety_guards": [
      {
        "rule": "min_authority_level",
        "max_limit": 2,
        "action_on_breach": "abort"
      }
    ]
  },
  {
    "id": "mem-trd-v2-009",
    "type": "strategy",
    "human_title": "Trading System v2.final: Сетки, дивергенции и ловушки маркет-мейкеров",
    "agent_summary": "Implement Trading System v2.final rules. Enforce RSI/AO divergences, SFP/sweep setups, BTC Range-Farm Bull-bias ladder long and local short-hedges. Apply leverage limit and red button stops.",
    "tags": [
      "trading",
      "trading",
      "system",
      "v2",
      "range",
      "farm"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Execution Guard",
          "address": "0x2E2E2E2E2E2E2E2E2E2E2E2E2E2E2E2E2E2E2E2E",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "https://api.binance.com/api/v3/klines"
      ],
      "constants": {
        "max_daily_dd_percent": 3,
        "min_rr_ratio": 2,
        "alt_scouting_cap_min_m": 7,
        "alt_scouting_cap_max_m": 60
      }
    },
    "safety_guards": [
      {
        "rule": "red_button_stops",
        "max_limit": 3,
        "action_on_breach": "halt_trading_24h"
      },
      {
        "rule": "leverage_limit",
        "max_limit": 3,
        "action_on_breach": "reduce_position"
      }
    ]
  },
  {
    "id": "mem-sol-mev-001",
    "type": "strategy",
    "human_title": "Solana MEV: Защита от сэндвич-атак",
    "agent_summary": "Mitigate MEV sandwich attacks on Solana. Use Jito Block Engine for private transactions. Enforce max slippage (0.5%) on Jupiter Swap API. Route: Jito tip address check.",
    "tags": [
      "infrastructure",
      "solana",
      "mev",
      "sandwich",
      "protection"
    ],
    "params": {
      "contracts": [
        {
          "name": "Jupiter V6 swap program",
          "address": "JUP6L81NS1289FQSSUXCVBNMASDFGHJKLMOPQ123",
          "chain": "solana"
        }
      ],
      "rpc_endpoints": [
        "https://mainnet.block-engine.jito.wtf/api/v1/bundles"
      ],
      "constants": {
        "jito_tip_accounts": [
          "96gYZz2EBXLHq7b5TthQs19x1p8Fdf52V2wy89Ty5Sg6",
          "HFqU5x63VTTCe84UbTvWYt15Ncu5FAWd2g71t8Q461cR"
        ],
        "min_tip_sol": 0.001
      }
    },
    "safety_guards": [
      {
        "rule": "max_slippage_bps",
        "max_limit": 50,
        "action_on_breach": "abort"
      },
      {
        "rule": "max_tip_amount_sol",
        "max_limit": 0.05,
        "action_on_breach": "cap_at_limit"
      }
    ]
  },
  {
    "id": "mem-nft-okx-002",
    "type": "strategy",
    "human_title": "OKX NFT: Охота на паразитарные кошельки",
    "agent_summary": "Scan and counter-bid NFT listings on OKX and OpenSea. Track target wallet \"binance:77zd77-98385b7be0d97ab4d6e49ba9334fddc5\". Implement immediate outbid of 0.0001 ETH above enemy offers.",
    "tags": [
      "trading",
      "okx",
      "nft",
      "parasite",
      "hunter"
    ],
    "params": {
      "contracts": [
        {
          "name": "OKX NFT Market Router",
          "address": "0x1234567890123456789012345678901234567890",
          "chain": "eth"
        }
      ],
      "rpc_endpoints": [
        "https://eth-mainnet.g.alchemy.com/v2/your-key"
      ],
      "constants": {
        "enemy_wallet": "0x77zd77b98385b7be0d97ab4d6e49ba9334fddc5",
        "outbid_delta_eth": 0.0001,
        "max_overpay_ratio": 1.15
      }
    },
    "safety_guards": [
      {
        "rule": "max_bid_amount_eth",
        "max_limit": 0.5,
        "action_on_breach": "abort"
      },
      {
        "rule": "max_overpay_ratio",
        "max_limit": 1.15,
        "action_on_breach": "abort"
      }
    ]
  }
];

	return new Response(JSON.stringify(guides), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	});
}
