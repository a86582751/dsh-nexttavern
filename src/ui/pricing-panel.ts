import type * as ReactAPI from 'react';
import { normalizePricingSettings } from './settings-projection.js';
export interface ModelRoute {
  provider?: string | null;
  model?: string | null;
}
interface PriceRate extends ModelRoute, Record<string, unknown> {
  mode?: string;
  multiplier?: number | null;
  catalogKey?: string | null;
  input?: number | null;
  output?: number | null;
  cacheRead?: number | null;
  cacheWrite?: number | null;
}
interface PriceSettings extends Record<string, unknown> {
  currency?: string;
  revision?: number;
  defaultMode: string;
  defaultMultiplier: number;
  autoSync: boolean;
  rates: PriceRate[];
}
interface CatalogInfo {
  source?: string;
  fetchedAt?: number | string | null;
  count?: number;
  stale?: boolean;
  syncing?: boolean;
  error?: string | null;
}
interface CatalogEntry extends ModelRoute {
  key: string;
}
interface CatalogReply {
  catalog?: CatalogInfo;
  entries?: CatalogEntry[];
}
export interface PricePanelDependencies {
  React: typeof ReactAPI;
  sessionDrafts: Map<string, Partial<PriceSettings>>;
  jsonFetch<T>(url: string, init?: RequestInit): Promise<T>;
  toast(message: string): void;
  statTime(value: number | string | null | undefined): string;
  errorMessage(error: unknown): string;
}
/** The factory keeps host React injection and a stable component identity per apply. */
export function createPricePanel({ React, sessionDrafts, jsonFetch, toast, statTime, errorMessage }: PricePanelDependencies) {
  function PricePanel({ sessionId, models, onSaved }: {
    sessionId: string;
    models?: ModelRoute[];
    onSaved?: () => void;
  }) {
    const draftKey = `${sessionId}:prices`,
      [data, setData] = React.useState<PriceSettings | null>(null),
      [busy, setBusy] = React.useState(false),
      [nativeCatalog, setNativeCatalog] = React.useState<ModelRoute[]>([]),
      [catalog, setCatalog] = React.useState<CatalogInfo>({}),
      [entries, setEntries] = React.useState<CatalogEntry[]>([]),
      [query, setQuery] = React.useState(''),
      [selected, setSelected] = React.useState(''),
      catalogRequest = React.useRef(0);
    const normalize = (raw?: Partial<PriceSettings> | null) => normalizePricingSettings(raw) as PriceSettings;
    const change = (next: PriceSettings) => {
      const normalized = normalize(next);
      setData(normalized);
      sessionDrafts.set(draftKey, normalized);
    };
    const loadCatalog = React.useCallback(
      async (search = '', keys: string[] = []) => {
        // A later catalog query owns the visible results even if the earlier request finishes last.
        const request = ++catalogRequest.current,
          q = new URLSearchParams({
            sessionId, q: search
          });
        if (keys.length)
          q.set('keys', JSON.stringify(keys));
        const result = await jsonFetch<CatalogReply>(`/api/roleplay/price-catalog?${q}`);
        if (request !== catalogRequest.current)
          return result;
        setCatalog(result.catalog ?? {});
        setEntries(result.entries ?? []);
        return result;
      },
      [sessionId]
    );
    React.useEffect(
      () => {
        let live = true;
        Promise.all([
          jsonFetch<{
            prices: PriceSettings;
          }>(`/api/roleplay/prices?sessionId=${encodeURIComponent(sessionId)}`),
          jsonFetch<{
            catalog?: ModelRoute[];
          }>(`/api/roleplay/models?sessionId=${encodeURIComponent(sessionId)}`)
        ]).then(([p, m]) => {
          if (!live)
            return;
        const saved = sessionDrafts.get(`${sessionId}:prices`);
          setData(normalize(saved ?? p.prices));
          setNativeCatalog(m.catalog ?? []);
        }).catch(e => toast(errorMessage(e)));
        return () => {
          live = false;
        };
      },
      [sessionId]
    );
    const routes = [
      ...new Map([...(models ?? []), ...(data?.rates ?? [])].filter(r => r?.provider && r?.model).map(r => [
        JSON.stringify([r.provider, r.model]),
        {
          provider: r.provider, model: r.model
        }
      ])).values()
    ];
    const rows = [
      ...new Map([
        ...(data?.rates ?? []),
        ...routes.filter(route => !(data?.rates ?? []).some(rate => rate.provider === route.provider && rate.model === route.model)).map(route => ({
          ...route,
          mode: data?.defaultMode ?? 'manual',
          multiplier: null,
          catalogKey: null,
          input: null,
          output: null,
          cacheRead: null,
          cacheWrite: null
        }))
      ].map(rate => [JSON.stringify([rate.provider, rate.model]), rate])).values()
    ];
    const catalogKeys = [
      ...new Set(rows.map(route => route.catalogKey ?? `${route.provider === 'deepseek-official' ? 'deepseek' : route.provider}/${route.model}`))
    ],
      catalogKeyToken = JSON.stringify(catalogKeys);
    React.useEffect(
      () => {
        const timer = setTimeout(
          () => loadCatalog(query, catalogKeys).catch(e => setCatalog({
            error: errorMessage(e)
          })),
          250
        );
        return () => clearTimeout(timer);
      },
      [query, loadCatalog, catalogKeyToken]
    );
    const updateRate = (route: PriceRate, patch: Partial<PriceRate>) => {
      if (!data)
        return;
      const index = data.rates.findIndex(rate => rate.provider === route.provider && rate.model === route.model);
      change({
        ...data,
        rates: index < 0 ? [
          ...data.rates,
          {
            ...route,
            mode: data.defaultMode,
            multiplier: null,
            catalogKey: null,
            input: null,
            output: null,
            cacheRead: null,
            cacheWrite: null,
            ...patch
          }
        ] : data.rates.map((rate, i) => i === index ? {
          ...rate, ...patch
        } : rate)
      });
    };
    const add = (raw: string) => {
      if (!raw || !data)
        return;
      const route = JSON.parse(raw);
      if (data.rates.some(r => r.provider === route.provider && r.model === route.model))
        return;
      change({
        ...data,
        rates: [
          ...data.rates,
          {
            ...route,
            mode: data.defaultMode,
            multiplier: null,
            catalogKey: null,
            input: null,
            output: null,
            cacheRead: null,
            cacheWrite: null
          }
        ]
      });
      setSelected('');
    };
    const sync = async () => {
      setBusy(true);
      try {
        const result = await jsonFetch<CatalogReply>(
          '/api/roleplay/price-catalog',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              sessionId, action: 'sync'
            })
          }
        );
        setCatalog(result.catalog ?? {});
        setEntries(result.entries ?? []);
        if (result.catalog?.error)
          toast('目录同步失败：' + result.catalog.error);

        else
          toast('目录已同步');
      }
      catch (e) {
        toast(errorMessage(e));
      }
      finally {
        setBusy(false);
      }
    };
    const save = async () => {
      if (!data)
        return;
      const hasAuto = data.defaultMode === 'auto' || data.rates.some(r => r.mode === 'auto');
      if (hasAuto && data.currency !== 'USD') {
        toast('自动定价只支持 USD：请先切换为 USD，或将全部模型改为手动；不会自动修改币种或清除手动价格。');
        return;
      }
      setBusy(true);
      try {
        const result = await jsonFetch<{
          prices: PriceSettings;
        }>(
          '/api/roleplay/prices',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              sessionId, settings: data, expectedRevision: data.revision
            })
          }
        );
        const next = normalize(result.prices);
        setData(next);
        sessionDrafts.delete(draftKey);
        toast('定价已保存');
        onSaved?.();
      }
      catch (e) {
        toast(errorMessage(e));
      }
      finally {
        setBusy(false);
      }
    };
    const exact = (r: ModelRoute) => ({
      provider: r.provider === 'deepseek-official' ? 'deepseek' : r.provider, model: r.model
    });
    const sourceLabel = (r: PriceRate) => {
      const match = entries.find(e => e.key === r.catalogKey)
        || entries.find(e => e.provider === exact(r).provider && e.model === exact(r).model);
      return match ? `${match.provider} / ${match.model}` : `${exact(r).provider} / ${exact(r).model}（未在目录中确认）`;
    };
    if (!data)
      return React.createElement('p', {
        className: 'dsh-rp-muted'
      }, '正在读取定价设置…');
    return React.createElement(
      'fieldset',
      {
        className: 'dsh-rp-pricing', disabled: busy
      },
      React.createElement(
        'p',
        {
          className: 'dsh-rp-muted'
        },
        '自动价格来自目录的精确供应商/模型匹配，金额单位为 USD/百万 tokens。中转站不会推断模型厂商；无目录匹配时显示 N/A。手动价格始终保留。'
      ),
      React.createElement(
        'div',
        {
          className: 'dsh-rp-pricing-grid'
        },
        React.createElement(
          'section',
          {
            className: 'dsh-rp-pricing-card'
          },
          React.createElement('h5', null, '默认规则'),
          React.createElement(
            'label',
            null,
            '币种 ',
            React.createElement(
              'select',
              {
                value: data.currency ?? 'USD',
                onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => change({
                  ...data, currency: e.target.value
                })
              },
              ['USD', 'CNY', 'EUR', 'JPY', 'HKD'].map(v => React.createElement('option', {
                key: v, value: v
              }, v))
            )
          ),
          React.createElement(
            'label',
            null,
            '默认模式 ',
            React.createElement(
              'select',
              {
                value: data.defaultMode,
                onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => change({
                  ...data, defaultMode: e.target.value
                })
              },
              React.createElement('option', {
                value: 'auto'
              }, '自动目录'),
              React.createElement('option', {
                value: 'manual'
              }, '手动单价')
            )
          ),
          React.createElement(
            'label',
            null,
            '默认倍率 ',
            React.createElement(
              'input',
              {
                type: 'number',
                min: 0,
                step: 'any',
                value: data.defaultMultiplier ?? 1,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => change({
                  ...data, defaultMultiplier: e.target.value === '' ? 1 : Number(e.target.value)
                })
              }
            )
          ),
          React.createElement(
            'label',
            {
              className: 'dsh-rp-row'
            },
            React.createElement(
              'input',
              {
                type: 'checkbox',
                checked: data.autoSync === true,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => change({
                  ...data, autoSync: e.target.checked
                })
              }
            ),
            '自动同步目录'
          )
        ),
        React.createElement(
          'section',
          {
            className: 'dsh-rp-pricing-card'
          },
          React.createElement('h5', null, '自动目录'),
          React.createElement(
            'div',
            {
              className: 'dsh-rp-muted'
            },
            `来源：${catalog.source ?? '未同步'} · ${catalog.fetchedAt ? statTime(catalog.fetchedAt) : '尚无更新时间'} · ${catalog.count ?? entries.length ?? 0} 项`
          ),
          catalog.stale ? React.createElement('div', {
            className: 'dsh-rp-error'
          }, '目录缓存已过期；可继续使用旧缓存或立即同步。') : null,
          catalog.error ? React.createElement('div', {
            className: 'dsh-rp-error'
          }, catalog.error) : null,
          React.createElement(
            'div',
            {
              className: 'dsh-rp-row'
            },
            React.createElement(
              'input',
              {
                placeholder: '搜索目录模型',
                value: query,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)
              }
            ),
            React.createElement(
              'button',
              {
                className: 'dsh-rp-btn', onClick: sync
              },
              catalog.syncing ? '同步中…' : '立即同步'
            )
          )
        )
      ),
      data.currency !== 'USD' && (data.defaultMode === 'auto' || data.rates.some(r => r.mode === 'auto')) ? React.createElement(
        'div',
        {
          className: 'dsh-rp-error', role: 'alert'
        },
        '自动定价只支持 USD。请切换为 USD，或把全部模型设为手动；保存不会隐式修改币种或清除手动价格。'
      ) : null,
      React.createElement(
        'div',
        {
          className: 'dsh-rp-row'
        },
        React.createElement(
          'select',
          {
            'aria-label': '添加定价模型',
            value: selected,
            onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value)
          },
          React.createElement('option', {
            value: ''
          }, '从当前模型或原生目录添加…'),
          [
            ...new Map([...routes, ...nativeCatalog].filter(r => r?.provider && r?.model).map(r => [JSON.stringify([r.provider, r.model]), r])).values()
          ].map(r => React.createElement(
            'option',
            {
              key: JSON.stringify(r),
              value: JSON.stringify({
                provider: r.provider, model: r.model
              })
            },
            `${r.provider} / ${r.model}`
          ))
        ),
        React.createElement(
          'button',
          {
            className: 'dsh-rp-btn', disabled: !selected, onClick: () => add(selected)
          },
          '添加模型'
        )
      ),
      React.createElement(
        'div',
        {
          className: 'dsh-rp-pricing-list'
        },
        rows.map(r => React.createElement(
          'section',
          {
            className: 'dsh-rp-pricing-card', key: JSON.stringify([r.provider, r.model])
          },
          React.createElement(
            'div',
            {
              className: 'dsh-rp-item-head'
            },
            React.createElement(
              'div',
              null,
              React.createElement('strong', null, r.model),
              React.createElement('div', {
                className: 'dsh-rp-muted'
              }, r.provider)
            ),
            React.createElement(
              'select',
              {
                'aria-label': `${r.model} 定价模式`,
                value: r.mode,
                onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => updateRate(r, {
                  mode: e.target.value
                })
              },
              React.createElement('option', {
                value: 'auto'
              }, '自动'),
              React.createElement('option', {
                value: 'manual'
              }, '手动')
            )
          ),
          r.mode === 'auto' ? React.createElement(
            'div',
            {
              className: 'dsh-rp-pricing-auto'
            },
            React.createElement(
              'label',
              null,
              '目录来源 ',
              React.createElement(
                'select',
                {
                  value: r.catalogKey ?? '',
                  onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => updateRate(r, {
                    catalogKey: e.target.value || null
                  })
                },
                React.createElement('option', {
                  value: ''
                }, sourceLabel(r)),
                entries.map(entry => React.createElement(
                  'option',
                  {
                    key: entry.key, value: entry.key
                  },
                  `${entry.provider} / ${entry.model}`
                ))
              )
            ),
            React.createElement(
              'label',
              null,
              '倍率 ',
              React.createElement(
                'input',
                {
                  type: 'number',
                  min: 0,
                  step: 'any',
                  placeholder: `默认 ${data.defaultMultiplier ?? 1}`,
                  value: r.multiplier ?? '',
                  onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => updateRate(
                    r,
                    {
                      multiplier: e.target.value === '' ? null : Number(e.target.value)
                    }
                  )
                }
              )
            ),
            React.createElement(
              'div',
              {
                className: 'dsh-rp-muted'
              },
              r.catalogKey ? '使用指定目录项；空值按精确 provider/model 查找。' : '空目录项会按精确 provider/model 匹配；deepseek-official 仅映射为 deepseek。'
            )
          ) :
            React.createElement(
              'div',
              {
                className: 'dsh-rp-pricing-manual'
              },
              (['input', 'output', 'cacheRead', 'cacheWrite'] as const).map(field => React.createElement(
                'label',
                {
                  key: field
                },
                ({
                  input: '输入', output: '输出', cacheRead: '缓存命中', cacheWrite: '缓存写入'
                })[field],
                React.createElement(
                  'input',
                  {
                    type: 'number',
                    min: 0,
                    step: 'any',
                    placeholder: 'N/A',
                    value: r[field] ?? '',
                    onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => updateRate(
                      r,
                      {
                        [field]: e.target.value === '' ? null : Number(e.target.value)
                      }
                    )
                  }
                )
              ))
            )
        ))
      ),
      React.createElement(
        'div',
        {
          className: 'dsh-rp-row'
        },
        React.createElement(
          'button',
          {
            className: 'dsh-rp-btn dsh-rp-primary', onClick: save
          },
          busy ? '保存中…' : '保存定价设置'
        )
      )
    );
  }
  return PricePanel;
}
