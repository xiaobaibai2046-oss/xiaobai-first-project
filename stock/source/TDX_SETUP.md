# 通达信官方SDK接入与验收

## 当前实际状态

本项目原为 Python标准库后端 + Node共享策略 + GitHub Actions定时扫描 + GitHub Pages静态手机站。
原行情来自腾讯，财务及2025年ROE池来自东方财富。本次保留这些备用源、策略和股票池。

已在本次开发环境安装官方PyPI包 `tdxaidata==1.3.1`，导入成功，Linux原生库加载成功；
已阅读随包官方文档 `tdxaidata/docs/tdxaidata使用文档.md`（2026-10-23版本），并核对源码签名。
用户给定官网地址目前被环境HTTP策略拦截，因此没有声称已读到网页正文：
https://help.tdx.com.cn/quant/docs/markdown/mindoc-1hjbgqpdhv114.html

官方INI配置的服务器：`aihs.tdx.com.cn:7709`、`aihs2.tdx.com.cn:7709`；专业数据 `aids.tdx.com.cn:7727`。
当前Codex环境TCP许可列表为空，适配器在原生调用前明确返回 `network_policy`。
两只验收股票的报价、历史日线、小时线、5分钟线、五档、分笔、GP07均被此项阻塞。
**没有真实价格、成交量或MA验收结果，不能声称账号认证成功、权限不足或积分不足。**
网络限制导致SDK行情调用计数为0；单元测试的合成数据不作为通达信真实接口证据。

HTTP域名配置草稿已保存，但保存草稿不会应用到当前实例，也不会授予原生TCP访问。
应在环境设置审查、保存并发布配置；若环境无法提供相应TCP授权，应在有这些权限的Python主机运行，
或先用现有GitHub Actions执行官方验收和定时采集。不要通过取消代理或修改系统路由绕过策略。

## GitHub Actions真实验收更新（2026-11-05）

Key保存到Repository Secret后，官方验收已成功：600519.SH和000001.SZ的快照、最近30个完整交易日日线、120根小时线、5分钟线和分笔均有真实返回。
随后以最多4次SDK调用补取两股日线和小时线，并通过现有Node生产模型 `summarizeStock/applyAnnualRoeGate/signalRecord`；MA20/MACD计算成功，ROE门槛保留。
两轮实际SDK调用计数分别为11和4，合计15，不等于积分数或费用金额。完整研究总评的最新财报本次没有请求。
五档没有识别到完整字段，GP07未返回可用数据；没有明确permission或credits错误，因此不能断言需要增购。
最新真实结果为 `validation/tdx-live.json`；`validation/tdx-integration.json`保留的是此前Codex本机受限的环境记录，两者不可混为同一运行环境。
正式全池在随后的明确用户授权后已开启，受 `market-config.json`、可选仓库变量及调用预算控制。

## 后端认证和启动

Key不进入仓库、前端、构建参数或URL。应用只从进程Secret `TDX_DATA_KEY` 或私有INI路径
`TDX_CONFIG_FILE`读取，官方SDK子进程在首次调用前将Token写入已安装SDK的 `lib/TdxAiData.ini`，
权限0600；父目录应只允许运行用户访问。开发环境临时Key在仓库外，不随提交或镜像分发。
使用独立虚拟环境，不与其他Key的应用共享SDK安装目录。运行用户须能写该SDK的lib目录。

```sh
cd stock/source
python3 -m venv .venv-tdx
.venv-tdx/bin/pip install -r requirements-tdx.txt
# 先通过你的服务Secret管理器设置TDX_DATA_KEY，或设置TDX_CONFIG_FILE为私有INI路径。
.venv-tdx/bin/python server.py --host 127.0.0.1 --port 8010
```

私有INI只需 `[Token]` 节中的 `token`；不要将实际Key写入本说明、命令参数或GitHub workflow文本。
官方进程的C/C++输出永久隔离；错误仅返回预定义类别与安全提示，不回传原生日志。
每次原生RPC最多等待25秒，超时终止子进程。采集器串行调用，至少间隔1秒，只对明确的网络错误重试1次。
认证或积分错误全局暂停5分钟，权限错误按接口／周期暂停5分钟，避免重复扣费。
默认每个采集进程最多100次SDK调用（`TDX_MAX_CALLS`可调整）；这不是账户级或全天费用上限。
一个SDK调用可能产生多次底层网络交互；不得把此计数当作官方计费单位。

缓存：报价/盘口共用一次快照，交易时10秒、其他时间5分钟；日线5分钟，小时/分钟1分钟。
完整日线或小时收盘切换时失效；并发请求合并。星期和沪深交易时段判断不替代交易所节假日日历。
缺失数据不向前填充，不发明OHLC或日期。SDK1.3.1无pandas的K线返回形状缺少日期索引，因此锁定pandas/numpy依赖。

## 接入现有API与模型

`/api/quotes`、`/api/history`、`/api/hourly` 已优先使用官方SDK，失败回退腾讯并保留
`primary_status.category`；`source`始终反映真实来源。官方缓存和公开源缓存隔离。
财务和ROE仍保持现有来源，不以月卡权限假定专业财务服务可用。

标准bars包含：`code/date或endTime/open/high/low/close/volume`。
`volume`沿用模型的手，另保留`volume_shares`；官方K线成交额万元转成`amount_cny`元。
快照Volume按官方“总手”保留；快照Amount倍率和交易所时间在官方字段表中未给出可靠保证时，
保留`amount_raw`与未核验状态，不伪造交易所时间，不把抓取时间当作成交时间。
因此实时快照价格可读取，但现有完整财务总评可能仍提示报价时点缺失。
正式60分钟MACD沿用不少于100根、0.3%容差、两根右侧确认及原有效期；ROE门槛不变。
标准行情另提供`analysis.MA5/MA10/MA20/MACD/RSI14`，RSI为Wilder14，MACD以首收盘价初始化。
这不会改变既有交易规则。30日验收的MACD暖机有限，不能当正式小时策略背离证明。

增量官方接口：`/api/tdx/minutes?code=600519&period=5m`、`/api/tdx/depth?code=600519`；
分笔和资金仅在`TDX_ENABLE_PRO=true`时开放：`/api/tdx/ticks`（最多10条）、`/api/tdx/funds`（GP07陆股通市场净买入）。
这些接口不会偷偷切到免费源来伪装官方成功。五档缺失标记`field_unavailable`，不能直接推断权限不足；
官方文档特别说明非报价界面买二至买五可能为空。

## 部署（材料已提供，未冒称已部署常驻服务器）

仓库内 `Dockerfile.tdx` 可从stock/source作为构建上下文，在允许TCP访问的Linux主机构建运行。
镜像以非root运行，Secret必须在运行时注入，不得放进镜像构建上下文。
本次未执行Docker构建或外部服务器部署，也没有申请付费主机。
对外发布应由现有HTTPS反向代理承载，不要直接将开发HTTP端口开放给所有人。

如果继续用GitHub Pages作手机入口，将Python后端公开HTTPS origin设置为仓库变量 `MARKET_API_BASE`，
后端环境设置 `MARKET_ALLOWED_ORIGIN=https://xiaobaibai2046-oss.github.io`，重建现有站点即可。
Key仍仅在Python后端。后端不可用时手机可回退原公开源，并注明来源；不能声称免费备份具有官方实时性。
常驻后端需由用户提供部署位置和安全凭证渠道，目前尚未提供。

## 现有GitHub Actions接入

1. 仓库 Settings → Secrets and variables → Actions，添加 Secret `TDX_DATA_KEY`（值仅在安全输入框中提供）。
   当前Codex的GitHub CLI认证不可用，不能代填该Secret；不要改成明文仓库变量。
2. 手动运行工作流 **Verify official Tongdaxin data**，需要专业接口测试时勾选 `include_pro`。
   也可以在Secret配置后告知助手，由助手通过提交不含密钥的 `stock/source/validation/tdx-request.json` 请求文件触发同一官方验收；此触发仅测两股，包含专业接口，总预算仍为20次SDK调用。
   输出只来自官方SDK；不通过验收会失败并保留安全报告artifact；同时提交不含原始K线和Key的 `validation/tdx-live.json` 结果摘要，便于助手通过现有Git权限复核。脚本总预算20次SDK调用。
3. 核验报告中两个代码的历史和报价确实success后，再将仓库变量 `TDX_ENABLED` 设置为`true`，
   现有四组云端扫描将安装SDK、读取加密Secret、优先使用通达信。未启用时仍走原免费路径。
   `TDX_MAX_CALLS_PER_SHARD`默认100，最多4组×2阶段，每轮可能达到800次SDK调用；此限制不是账户级全局配额。
   在官方确认单价前不建议直接开全池高频调用。SDK缓存随采集进程使用，跨runner不共享账户预算。

```sh
# 在已配置认证且允许官方TCP访问的Python后端执行：
.venv-tdx/bin/python scripts/verify-tdx.py --include-pro --output /tmp/tdx-report.json
```

验收固定600519.SH与000001.SZ，取31根日线后剔除未收盘日并选最近30个实际返回交易日，
输出真实最新价格、成交量和MA5/MA20；另测试1h、5m、盘口、分笔、GP07。
少于30个完整交易日标记insufficient_rows，绝不填充模拟价格。未通过认证或网络不能估算MA。

## 权限与费用

没有证据证明“普及版月卡”覆盖全部API；目前每项的账号权限和积分结果都未验证。
随包官方文档未列出可据以报价的积分单价，因此没有可靠金额估算，也不据此建议增购。
应先取得真实验收结果和官方积分账单／接口价目表，再决定是否额外购买。
`permission`、`credits`、`authentication`、`network`、`network_policy`、`rate_limit`、`budget`、`schema`、`unavailable`分别报告。

本地回归：`npm test` 和 `npm run test:api`。`test_tdx_provider.py`是明确合成契约测试，不能替代上述真实验收。

## 全池启用（用户授权：2026-11-05）

`market-config.json` 已启用通达信优先；仓库变量TDX_ENABLED如未设置，则读取项目配置，明确设false仍可停用。
用户已授权全池调用，首轮按新的refresh_generation重查1264只，即使备用源同一时段结果尚有效也不跳过。
后续按完整K线时段复用官方缓存，不重复消耗同一时段的SDK请求；官方缓存命名空间不接收备用数据。
首批每组150次、补扫每组750次，4组上限3600次SDK调用/轮，实际调用数另行报告；这不是积分或金额承诺。
正式扫描仅按需获取小时和日线，不拉全池逐笔、盘口或资金数据；异常或预算用尽继续使用原备用源，并保留来源信息。
补扫扫描预算由540秒改为720秒，任务总超时保护保留。新快照报告官方小时线覆盖数和本阶段实际SDK调用数。

首轮全池实测于2026-11-05北京时间22:16发布快照：1264只全部重新检查，最新完整官方小时线指标覆盖1250只；买入123、卖出516、未触发615、数据不足10，待更新0。另4只可确认日线卖出但小时线不足以完成MACD。
首批SDK476次、补扫1890次，合计2366次，未到3600上限；没有观察到明确权限或积分不足错误。摘要见 `validation/tdx-full-pool.json`。
