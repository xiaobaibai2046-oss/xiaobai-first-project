import {test} from 'node:test';import assert from 'node:assert/strict';
import {isTradingDay} from './trading-calendar.js';
import {expectedSignalTime} from './signal-model.js';
test('holidays and working-weekend adjustments never create stock exchange sessions',()=>{
 for(const d of ['2026-01-02','2026-02-23','2026-10-05','2026-10-10','2026-11-07'])assert.equal(isTradingDay(d),false,d);
 assert.equal(isTradingDay('2026-11-06'),true);
 assert.equal(expectedSignalTime(new Date('2026-10-05T07:05:00Z')),'2026-09-30T15:00:00+08:00');
 assert.equal(expectedSignalTime(new Date('2026-10-08T01:00:00Z'),'daily'),'2026-09-30');
});
