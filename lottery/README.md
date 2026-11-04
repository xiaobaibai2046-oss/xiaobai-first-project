# 缺区观察 · 双色球研究台

发布入口：https://xiaobaibai2046-oss.github.io/xiaobai-first-project/lottery/

沿用仓库现有 GitHub Pages main 分支根目录发布；独立于其他页面。index.html 内嵌脚本、样式和数据，不依赖第三方前端资源。手机 Safari/Chrome 可直接访问，可从浏览器菜单添加到主屏幕（不提供离线缓存）。

规则：所选区的当前遗漏严格超过历史相邻缺席事件平均间隔的2倍，生成另外两区六红，排除历史六红组合，每组覆盖16蓝。规则没有已验证的中奖概率优势。

内置3523期第三方快照，截至2026-11-03，非实时数据。支持导入整份JSON/CSV替换，仅当前页面有效，刷新恢复内置快照。请按页面标示的数据末期理解信号。

## 维护

源码与测试在 source/。修改后执行：

```sh
cd lottery/source
npm test
python3 build_standalone.py
cp 双色球缺区观察.html ../index.html
```

提交更新后的源码和 lottery/index.html，现有 Pages 设置会发布；不需要额外部署工作流或运行服务器。
