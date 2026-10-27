# 知衡 · 手机 A 股研究台

发布地址：https://xiaobaibai2046-oss.github.io/xiaobai-first-project/stock/

与向野路书共用 GitHub Pages，main 分支根目录发布。stock/index.html 是单文件应用，不需要临时 Python 服务器，独立于路书首页。

手机使用：Safari 或 Chrome 打开以上地址，可通过浏览器菜单“添加到主屏幕”。在建立股票池页输入六位代码，获取报价并载入日线；在分析企业页获取财务摘要，在定期复盘页运行回测。首次使用可选择演示数据，但演示结果不是真实股票。

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
