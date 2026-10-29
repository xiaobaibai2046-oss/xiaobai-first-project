# 知序 · 南京初中学习空间

九科基础学习应用，独立于原旅行网站，手机和电脑均可使用。无需第三方运行依赖、账号或密钥。

公网路径沿用原 GitHub Pages：`https://xiaobaibai2046-oss.github.io/xiaobai-first-project/jiangsu-study/`。

## 当前实际数量

| 内容 | 数量与性质 |
| --- | --- |
| 九科知识点 | 每科 100 个，合计 900 个 |
| 知识点原创练习 | 900 道：保留 129 道单选，新增 771 道判断，每个知识点至少一道 |
| 据第三方试卷转录改编 | 17 道：安徽省、深圳；题目与解析独立整理，非原题逐字复刻 |
| 公开资料入口 | 27 条：22 份深圳文档转录入口，5 条安徽省卷分段转录入口 |
| 官方原卷已独立核对题 | 0 道；不以转录或改编数量替代官方核验量 |
| 旧版教材目录 | 人教数学六册、苏科数学六册、苏教生物四册，共 16 册 87 章 |
| 旧版教材关联知识点 | 59 个；不代表整章、现行教材或南京中考范围完整覆盖 |

九科为语文、数学、英语、物理、化学、生物、历史、地理和道德与法治。体育、信息科技、艺术等尚未收录。

知识点和试卷资料分组计数。900 道原创入门练习不是中考真题，17 道改编也不是 17 份完整原卷；27 条入口并非 27 份官方核验试卷。

## 运行与发布

在仓库根目录运行：

```bash
python3 -m http.server 8010 --bind 0.0.0.0
```

通过该 HTTP 服务的 `/jiangsu-study/` 路径使用。ES 模块应通过 HTTP 加载，不使用 file 协议。原旅行网站保留在根路径。本应用无需运行原网站的构建脚本。正式发布继续推送本目录到现有 GitHub Pages 的 main 分支，随后检查 Pages 部署结果。

## 学习与练习

- 按学科、建议年级、知识主题、关键词和有来源的版别筛选，每页 36 个，显示总数与页码。
- 每条包含原创讲解和配套客观练习；新判断题针对具体误解、语境或条件，不是把标题自动当问题。选择题与判断题均提供解析。
- 答前可展开提示，答后可回看讲解或重试。混合练习随机顺序；本轮成绩按每题最近一次作答计算，每次实际提交均保留在累计答题记录中。
- 答错进入错题本，重新答对移出。主动“标记学完”表示阅读完成，不自动认定掌握程度。
- 771 道新题主要属于入门辨析，不能替代计算、证明、实验、阅读写作等全部综合题型。后续仍应增加进阶变式、图示及学科审阅。

通用模式的年级是导航建议；具体版别筛选依已读取旧版镜像册次。例如反比例函数在这里的苏科目录为八下、人教目录为九下，不能机械套同一推荐年级。

## 各地近五年试卷资料

窗口为 2022—2026。地区不再限定南京，省卷按省标注，城市卷按城市标注。可同时按地区、年份、学科、题目身份和待巩固状态筛选，并单独分页查看资料入口。

### 实际读取的来源

- 安徽：`chrisjame/learn_third_year_of_middle_school_math` 固定提交 `bebe942dfcfbcbbacc72e587e5731df8dfed1ee0`，读取 `source/exams/nokey/pages/` 中 2022—2026 年题头及可辨识题干。入口是汇编分段文字，**不是完整原卷下载**；原 PDF 使用 Git LFS，当前下载另受集成权限限制。
- 深圳：`szkakalau/szzk-llm` 固定提交 `9963806b0c1ffc9dcca90173ccd2ef7a2b68ded9`，实际读取 22 份 2022—2025 年试卷 Markdown 转录。未使用该仓库 AI 扩增训练数据冒充真题。部分原文件标回忆版、含机构加工痕迹或缺失图片公式，均保留限制说明。
- 官方、教育资源网站的直接请求当前仍受到网络代理 403 限制；不假称已读取官方原卷。南京原卷缺口仍存在。

[paper-catalog.js](./paper-catalog.js) 保存入口的文件路径、固定提交及所读文字 SHA-256。[sourced-exams.js](./sourced-exams.js) 保存改编说明、原转录题号、地区年份、知识点关联和自编解析。[source-investigation.json](./source-investigation.json) 记录检索与排除情况。

17 道内置资料题全部标 `adapted` / `transcript-reviewed`：所据转录已读并独立解题，但地区、年份依来源标注，**未独立核验官方原卷**。简化背景、重设缺失选项的题目明确标改编，不复刻第三方解析。产品不分发整本教材或整套第三方试卷，只提供公开链接及所整理的小量改编练习。

## 导入、记录与备份

支持 UTF-8 JSON，格式见 [exam-pack.schema.json](./exam-pack.schema.json)，知识点 ID 见 [knowledge-index.json](./knowledge-index.json)。Schema 是说明文件，不是试题资料包。

顶层为 `{"schemaVersion":1,"questions":[...]}`。每题必填：`year`（2022—2026）、`city`（实际城市或省卷地区）、`subject`、`questionNumber`、`type`、`prompt`、`source.title`、`source.locator`、`explanation`。可选 `kind` 为 `original`、`adapted`、`recalled` 或 `past-paper-claim`；不填时身份待核对。`lessonIds` 关联知识点。

- 单选 `single-choice`：2—8 个纯文字选项 `options`，从 0 开始的有效答案索引 `answer`。
- 主观题 `written`：需有 `reference`，只对照、手动标记，不自动计分。
- 每批最多 500 题、2 MB，本机最多 2000 题。依据地区、年份、学科、题号区分；不同卷别应写入题号。同内容去重、冲突拒绝覆盖。
- `source.url` 可省略；填写时仅允许不含账号密码的 HTTPS 地址。
- 用户导入始终是 `user-provided`，即使声称 verified 或 original 也不会提高核验等级。
- 应用不直接解析 PDF、图片或 Word，不做 OCR；需先整理成该结构。

记录只存当前浏览器，不上传、不跨设备同步。旧键 `zhixu-nanjing-v1`、`zhixu-nanjing-exams-v1` 保留。原南京资料题 ID 不变，其他地区使用带地区的 ID，避免同年同题号碰撞；内置改编题另用 public 命名空间。导出与恢复备份保留本机题目、最近 1000 次资料答题，合并去重并拒绝冲突。

## 教材来源与边界

旧版镜像来自 [TapXWorld/ChinaTextbook](https://github.com/TapXWorld/ChinaTextbook)，[textbook-catalog.js](./textbook-catalog.js) 保存原文件 SHA-256、固定提交、目录页和关联。可确认版次据版权页写出，不能确认的标未知旧版。状态 `source-read` / `mirror-linked` 不代表出版社官方认证或南京现行用书确认。87 章均只关联入门知识，不等于细分全覆盖。

## 维护与验证

- `content/*.js`：原创补充讲解。原有行不能重排，以保持知识点 ID 稳定。
- `practice/*.js`：按学科与标题人工撰写的判断表述和真假标注；模块检查是否每条均有配题。
- `data.js`、`expanded-data.js`、`chapter-lessons.js`：原讲解与单选；短解析在本轮补充了关键依据。
- `model.js`、`app.js`：知识点筛选、练习与进度；`exams.js`、`exam-ui.js`：各地资料。
- `CONTENT_REVIEW.md`：早期内容不足的原因与历次修补记录。

```bash
node jiangsu-study/scripts/audit-content.mjs
node --test jiangsu-study/*.test.js tests/*.test.js
```

审计刷新 [content-audit.json](./content-audit.json) 和知识点索引，检查各科数量、去重、题目结构和来源边界。42 项 Node 测试通过。真实 Chromium 验证每科配题、判断/单选、提示、错后重试、计分不膨胀、17 道改编的地区与身份、27 个唯一入口的分页、其他地区导入恢复及 320/390/760 像素手机布局。结构化检查不能替代学科与官方来源核验。
