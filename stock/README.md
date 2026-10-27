# 知衡 · 手机 A 股研究台

发布地址：https://xiaobaibai2046-oss.github.io/xiaobai-first-project/stock/

与向野路书共用 GitHub Pages，main 分支根目录发布。stock/index.html 是单文件应用，不需要临时 Python 服务器，独立于路书首页。

股票池：新增2025年年报加权平均ROE严格大于10%的沪深北A股池，初始核验快照1264只，来源覆盖5580条年报。支持搜索、导出、市场筛选和点选分析；数据缺失单列，不把未披露／未覆盖公司当作不达标。

手机使用：Safari 或 Chrome 打开以上地址，可通过浏览器菜单“添加到主屏幕”。首页输入六位代码，点击“一键分析”或按回车，即并行读取报价、日线和财报，先显示研究结论、依据与风险。六步明细和普通主板历史实验自动生成；如需调整参数，再展开下方的六步工具。结论含独立买入／卖出观察：日线只看MA20，结合60分钟MACD的DIF背离；右侧2根K线确认后才显示信号。历史收益仅为MA20日线独立实验，未包含60分钟背离。首次使用可选择演示数据，但演示结果不是真实股票。

公开报价可能延迟；回测未计分红送转和完整历史涨跌停状态。笔记只保存于当前浏览器，请导出备份；不同设备不自动同步。不提供交易下单。

## 维护

源代码、测试和完整方法说明在 source/。修改源文件后：

```sh
cd stock/source
npm test
npm run test:api
npm run build -- ..
```

将 source/ 与上层生成的 index.html、manifest.webmanifest、icon.svg、.nojekyll 一起提交到 main，GitHub Pages 自动部署。运行本地带后端版本可在 source/ 执行 npm start；线上静态版不使用这个进程。
