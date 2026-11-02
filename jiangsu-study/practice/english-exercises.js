import {add} from './quality-bank.js';
// Every row supplies an actual language context and an explanation of the target structure.
const packs={
'一般现在时的主谓一致':[
['My brother ___ to school by bus every day.','goes','go / going / gone','every day 表示习惯，主语 My brother 为第三人称单数，go 加 -es。'],
['Lucy and Lily ___ in Nanjing.','live','lives / living / lived','并列主语表示两个人，一般现在时用动词原形 live。'],
['The earth ___ around the sun.','moves','move / moving / moved','表示客观事实，主语 the earth 为单数，使用 moves。'],
['Tom ___ like coffee.','does not','do not / is not / are not','一般现在时否定实义动词，第三人称单数用 does not，后接原形 like。'],
['___ your father work in a hospital?','Does','Do / Is / Are','询问一般现在时的实义动词，单数主语 your father 用助动词 Does。'],
['Each student ___ a schoolbag.','has','have / having / are having','each 修饰单数名词，主语 Each student 用单数谓语 has。'],
['The children usually ___ games after class.','play','plays / playing / played','children 是复数，usually 提示习惯，用 play。'],
['Water ___ at 100°C at standard atmospheric pressure.','boils','boil / boiling / boiled','这是客观规律，water 为不可数名词，谓语用单数 boils。'],
['My parents ___ watching the news every evening.','enjoy','enjoys / enjoying / enjoyed','复数主语 My parents 用原形 enjoy，every evening 提示一般现在时。']
],
'一般过去时':[
['We ___ the museum last Sunday.','visited','visit / visits / visiting','last Sunday 是过去时间，visit 的过去式是 visited。'],
['Did he ___ the window yesterday?','close','closed / closes / closing','助动词 Did 已体现过去时，后面实义动词恢复原形。'],
['She ___ at home last night.','was','is / are / were','last night 用过去时，单数主语 She 对应 was。'],
['They ___ to Beijing two years ago.','went','go / goes / going','two years ago 表示过去，go 的过去式为 went。'],
['I ___ see the film yesterday because I was ill.','did not','do not / does not / am not','过去时否定句用 did not 加动词原形 see。'],
['When I was six, I ___ in a small village.','lived','live / lives / living','When I was six 限定过去时间，主句使用 lived。'],
['—When did you arrive? —I ___ at nine this morning.','arrived','arrive / arrives / arriving','问已经发生的到达事件，回答用过去式 arrived。'],
['The teacher ___ us an interesting story yesterday.','told','tell / tells / telling','yesterday 限定过去，tell 的过去式为 told。'],
['—___ you at school yesterday? —Yes, I was.','Were','Are / Was / Do','主语 you 的 be 动词过去式为 were，回答中主语 I 用 was。']
],
'被动语态的基本结构':[
['English ___ in many countries today.','is spoken','speaks / spoke / is speaking','English 是 speak 的承受者；一般现在时被动结构 is spoken。'],
['These books ___ by young readers every year.','are read','read / reads / is read','复数主语 These books 是 read 的承受者，故用 are read。'],
['The classroom ___ every afternoon.','is cleaned','cleans / cleaned / is cleaning','教室被打扫，单数主语、一般现在时用 is cleaned。'],
['Many trees ___ in our town every spring.','are planted','plant / plants / is planted','树被种植；复数主语 trees 搭配 are planted。'],
['This machine ___ to cut paper.','is used','uses / used / is using','机器被用于切纸，be used to do 在此是被动结构，选 is used。'],
['The doors ___ at seven every morning.','are opened','opens / is opened / opening','门被打开，doors 为复数，使用 are opened。'],
['Chinese ___ by more and more learners today.','is learned','learns / learned / is learning','Chinese 是被学习的语言，使用 is learned。'],
['The windows ___ once a week.','are washed','wash / washes / is washed','复数主语 windows 是 wash 的承受者，选 are washed。'],
['Rice ___ by local farmers in many parts of southern China.','is grown','grows / grow / are grown','强调稻米被种植，rice 为不可数名词，使用 is grown。']
],
'可数名词的复数':[
['There are three ___ on the desk.','books','book / a book / booking','three 后用可数名词复数 books。'],
['Two ___ are playing outside.','children','child / childs / a child','child 的不规则复数为 children。'],
['I need two ___ to fix this shelf.','knives','knife / knifes / a knife','knife 的复数变 f 为 v 再加 -es：knives。'],
['There are five ___ in the classroom.','boxes','box / boxs / a box','box 以 x 结尾，复数加 -es。'],
['These ___ are very clean.','buses','bus / buss / a bus','These 后跟复数，bus 的复数为 buses。'],
['Three ___ are waiting near the door.','women','woman / womans / a woman','woman 的复数是 women。'],
['The baby has two new ___.','teeth','tooth / tooths / a tooth','tooth 的不规则复数为 teeth。'],
['There are several ___ in the shop.','watches','watch / watchs / a watch','watch 以 ch 结尾，复数加 -es。'],
['Two ___ ran into the hole.','mice','mouse / mouses / a mouse','mouse 的复数为 mice。']
],
 'there be 句型':[
['There ___ a cat under the table.','is','are / have / has','a cat 为单数，there be 表存在，用 is。'],
['There ___ three birds in the tree.','are','is / have / has','three birds 为复数，there be 用 are。'],
['There ___ some milk in the glass.','is','are / have / has','milk 为不可数名词，there be 用 is。'],
['There ___ a pen and two books on the desk.','is','are / have / has','there be 采用就近原则，紧接的 a pen 为单数，用 is。'],
['There ___ two books and a pen on the desk.','are','is / have / has','就近主语 two books 为复数，使用 are。'],
['___ there any water in the bottle?','Is','Are / Do / Does','water 不可数，疑问句将 Is 提前。'],
['There ___ a meeting yesterday.','was','is / are / were','yesterday 提示过去时，a meeting 单数，故用 was。'],
['There ___ many people at the party last night.','were','was / is / has','过去时间且 people 为复数，选 were。'],
['There ___ a sports meeting next week.','will be','will have / has / are','将来的存在句用 there will be，不能用 there will have。']
],
'形容词比较级':[
['This box is ___ than that one.','heavier','heavy / heaviest / more heavy','than 表比较，heavy 变 y 为 i 加 -er。'],
['My bag is ___ than yours.','bigger','big / biggest / more big','big 的比较级双写 g 再加 -er：bigger。'],
['This film is ___ than the one we saw yesterday.','more interesting','interesting / most interesting / interestinger','多音节形容词 interesting 的比较级用 more interesting。'],
['Today is ___ than yesterday.','colder','cold / coldest / most cold','than 提示比较级 cold-er。'],
['My English is getting ___.','better','good / best / wellest','此处表示变得更好，good 的比较级是 better。'],
['This road is ___ than that one.','wider','wide / widest / more wide','wide 以 e 结尾，加 -r 得 wider。'],
['The second problem is ___ than the first.','more difficult','difficult / most difficult / difficulter','difficult 的比较级使用 more difficult。'],
['His handwriting is much ___ now than before.','better','best / good / more good','much 可以修饰比较级；good 的比较级为 better。'],
['She is two years ___ than her sister.','older','old / oldest / more old','比较年龄使用 older，“two years”说明相差两岁。']
],
'现在完成时的基本结构':[
['I ___ my homework already.','have finished','finish / finishes / am finishing','already 提示已完成，I 搭配 have，后接过去分词 finished。'],
['She ___ the book before.','has read','have read / is reading / reads','主语 She 用 has，read 的过去分词仍写作 read。'],
['We ___ each other for five years.','have known','know / knew / are knowing','for five years 表示持续到现在的时间段，用 have known。'],
['He ___ in Nanjing since 2020.','has lived','have lived / lives / is living','since 2020 表示从过去持续至今，He 搭配 has lived。'],
['They ___ the classroom, so it is clean now.','have cleaned','cleans / is cleaning / has cleaned','过去的打扫对现在产生结果，复数主语用 have cleaned。'],
['___ you ever visited the Great Wall?','Have','Has / Do / Are','ever 询问经历，you 的现在完成时疑问结构为 Have you visited。'],
['Tom ___ not seen this film yet.','has','have / is / does','has not seen 是第三人称单数的现在完成时否定结构。'],
['My parents ___ already arrived at the station.','have','has / are / do','主语 My parents 为复数，使用 have arrived。'],
['I have never ___ such a beautiful lake.','seen','saw / see / seeing','have 后接过去分词，see 的过去分词是 seen。']
],
'情态动词后的动词形式':[
['You should ___ more water.','drink','drinks / drank / drinking','情态动词 should 后使用动词原形 drink。'],
['Jenny can ___ across this pool.','swim','swims / swam / swimming','can 后用动词原形，不随第三人称单数变化。'],
['We must ___ quiet in the library.','keep','keeps / kept / keeping','must 是情态动词，后接动词原形 keep；quiet 是表语，不应将 keep 改为第三人称单数或动名词。'],
['May I ___ the window?','open','opens / opened / opening','情态动词 May 后使用原形 open。'],
['She might ___ late today.','be','is / was / being','might 后接原形 be，不能使用 is。'],
['You must not ___ here.','smoke','smokes / smoked / smoking','must not 表禁止，后面使用原形 smoke。'],
['Could you ___ me with this box?','help','helps / helped / helping','Could 用于礼貌请求，后接原形 help。'],
['He need not ___ now.','leave','leaves / left / leaving','此处 need 作情态动词，need not 后接原形 leave。'],
['We should ___ the rules.','follow','follows / followed / following','should 后动词用原形 follow。']
],
'宾语从句的语序':[
['Could you tell me ___?','where the station is','where is the station / where does the station be / where the station are','宾语从句用陈述语序：疑问词＋主语＋谓语，选 where the station is。'],
['I wonder ___.','what he likes','what does he like / what is he like it / what he like','从句主语 he 在谓语 likes 之前；不能保留直接问句的 does。'],
['The schedule may change. Do you know ___ today?','when the train leaves','when does the train leave / when is the train leave / when the train leave','宾语从句用陈述语序，train 为单数，谓语 leaves。'],
['Please tell me ___.','how I can get there','how can I get there / how do I can get there / how get I there','从句主语 I 放在 can 前，使用 how I can get there。'],
['I do not know ___.','why she is absent','why is she absent / why does she absent / why she absent is','从句保持 she is absent 的陈述语序。'],
['Can you tell me ___?','where they live','where do they live / where are they live / where they lives','they live 是陈述语序，不使用疑问句助动词 do。'],
['I want to know ___.','what time it is','what time is it / what it is time / what time does it','宾语从句中 it 在 is 前，选 what time it is。'],
['Could you explain ___?','how this machine works','how does this machine work / how is this machine work / how this machine work','this machine 为单数，陈述语序使用 works。'],
['She asked ___.','where I had put the key','where had I put the key / where did I had put the key / where I the key had put','从句保持主语 I＋谓语 had put 的顺序。']
],
'条件状语从句的时态':[
['If it ___ next Monday, we will not have PE outside.','rains','will rain / rained / raining','主句一般将来时，if 条件从句用一般现在时表示将来，it 搭配 rains。'],
['I will call you if I ___ there early.','arrive','will arrive / arrived / arriving','if 条件从句遵循主将从现，主语 I 用 arrive。'],
['If he ___ hard, he will pass the exam.','studies','will study / studied / studying','条件从句用一般现在时，he 对应 studies。'],
['We will go out if the weather ___ fine.','is','will be / was / being','将来条件从句使用一般现在时，weather 对应 is。'],
['If you ___ now, you will catch the bus.','leave','will leave / left / leaving','条件从句中用 leave 表示将来动作。'],
['She will be happy if you ___ her.','help','will help / helped / helping','主句 will be，if 条件从句用 help。'],
['If the shop ___ open tomorrow, I will buy a pen.','is','will be / was / being','条件从句用一般现在时 is，tomorrow 不要求从句使用 will。'],
['You will miss the train if you ___ hurry.','do not','will not / did not / are not','从句否定实义动词 hurry，使用一般现在时 do not。'],
['If Lucy ___ time next Sunday, she will visit us.','has','will have / had / having','if 表条件时，从句用 has 表示将来拥有时间。']
]
};
for(const [title,rows] of Object.entries(packs))for(const [question,right,wrong,reason] of rows){const options=[right,...wrong.split(' / ')];const shift=question.length%4;options.push(...options.splice(0,shift));add(title,question,options,options.indexOf(right),reason);}
