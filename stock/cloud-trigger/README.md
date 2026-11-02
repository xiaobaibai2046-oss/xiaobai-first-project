# 免费云端扫描的独立备用触发器（待部署）

此目录是 Cloudflare Workers Cron Trigger 的部署材料，**提交到 GitHub 并不会自动启用**。
原 GitHub 定时器、行情来源、扫描规则、发布步骤和网站地址保持原样。

## 如何补漏

原 GitHub 计划北京时间工作日10:05—15:50，每15分钟触发，16:05补查日线。
Cloudflare 在各计划时点的3分钟后检查原工作流：

- 已有运行或排队任务：跳过，避免继续堆积。
- 本时段已成功完成：跳过。
- 没有运行记录，或本时段运行已失败：通过 GitHub 官方 workflow_dispatch API 触发原工作流。
- API查询失败或授权失效：报告错误，不盲目重复启动任务。

北京时间备用时点为10:08—15:53（每15分钟），以及16:08。配置内使用UTC。
与原程序一样按周一至周五安排，没有交易所节假日日历。

它能减少依赖单一调度器造成的漏触发，不能保证 GitHub 运行器立即开工，也不能解决行情源缺失。
备份触发器、GitHub Actions 和行情接口任何一环都可能失败；任务触发成功不等于数据分析或发布成功。

## 启用前需要

1. Cloudflare 免费账号，使用 Workers 免费计划；不启用付费计划或其他收费产品。
2. GitHub 仓库所有者创建 fine-grained personal access token：
   - 仅选择 `xiaobaibai2046-oss/xiaobai-first-project` 这个仓库。
   - Repository permissions 的 **Actions: Read and write**，用于查询运行记录和手动触发工作流。
   - 配置到期时间，并在到期前更换，否则备用触发会停止。
3. 将令牌仅保存为 Worker 的 **Secret** `GITHUB_TOKEN`。不要粘贴到聊天、源码或浏览器网页。

## 部署方式

已有 Node.js 的电脑可以使用官方 Wrangler CLI。进入本目录后：

```sh
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

`secret put` 会提示安全输入令牌；不要把令牌写进命令文本。
`wrangler.jsonc` 已填仓库名称和两个备用定时表达式。保留 `workers_dev: false`，不需要域名或公开HTTP接口。

也可以在 Cloudflare 控制台创建 Worker，将 `worker.mjs` 内容放入编辑器：

- Settings → Variables and Secrets：添加文本变量 `GITHUB_REPOSITORY`，值为 `xiaobaibai2046-oss/xiaobai-first-project`；添加 Secret `GITHUB_TOKEN`。
- Triggers/Cron Triggers：添加 `8,23,38,53 2-7 * * 1-5`、`8 8 * * 1-5`（均为UTC）。
- 禁用公开 workers.dev 路由，无需配置自定义域名。

界面名称可能随 Cloudflare 版本调整。先确认免费计划再部署。

## 验收

1. 在 Cloudflare 控制台核对 Cron Triggers 已生效；首次配置可能需要传播时间。
2. 等待下个备用时点，在 Worker 的执行日志中查看：
   - `dispatched`：GitHub接受了补触发请求，尚不代表分析完成。
   - `already_running`：原任务已在运行或排队。
   - `already_completed`：当前时段已成功运行。
3. 在 GitHub Actions 中确认出现 `workflow_dispatch` 运行并完成。
4. 确认 Pages发布成功，以及网站快照和单股K线时点确实更新，不能只看任务是否成功。
5. 至少观察一个完整交易日的执行记录后再判断可靠性是否改善。

本地逻辑测试（不访问线上API）：

```sh
node --test worker.test.mjs
```

要停用备用方案，在 Cloudflare 删除这两个 Cron Triggers 即可；原 GitHub 路径继续保留。
