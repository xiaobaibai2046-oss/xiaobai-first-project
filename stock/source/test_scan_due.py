import datetime as dt
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('scan_due',Path(__file__).parent/'scripts/scan-due.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DueTests(unittest.TestCase):
    def test_late_catchup_deduplicates_same_slot_and_does_not_stop_after_16(self):
        pool={'stocks':[{'code':str(i)} for i in range(100)]}
        now=dt.datetime.fromisoformat('2026-11-06T10:35:00+08:00');target='2026-11-06T10:30:00+08:00'
        self.assertTrue(module.scan_due({},pool,now)['run'])
        results={str(i):{'checked_session':target,'hourly_as_of':target if i<98 else None,'state':'none' if i<98 else 'incomplete'} for i in range(100)}
        self.assertFalse(module.scan_due({'results':results},pool,now)['run'])
        self.assertTrue(module.scan_due({'results':results},pool,now.replace(hour=11,minute=35))['run'])
        self.assertTrue(module.scan_due({},pool,now.replace(hour=18))['run'])
        self.assertFalse(module.scan_due({},pool,now.replace(hour=10,minute=34))['run'])
    def test_outage_does_not_count_as_successful_scan_and_weekends_skip(self):
        pool={'stocks':[{'code':'600519'}]};now=dt.datetime.fromisoformat('2026-11-06T10:45:00+08:00')
        self.assertTrue(module.scan_due({'results':{'600519':{'checked_session':'2026-11-06T10:30:00+08:00','hourly_as_of':None}}},pool,now)['run'])
        self.assertFalse(module.scan_due({},pool,now.replace(day=7))['run'])
        failed={'results':{'600519':{'checked_session':'2026-11-06T10:30:00+08:00','hourly_as_of':'2026-11-06T10:30:00+08:00','state':'incomplete'}}}
        self.assertTrue(module.scan_due(failed,pool,now)['run'])

    def test_bounded_retry_and_strategy_migration(self):
        state={};result={'run':True,'target':'2026-11-06T10:30:00+08:00'}
        self.assertTrue(module.guard_attempts(result,state)['run']);self.assertTrue(module.guard_attempts(result,state)['run']);self.assertFalse(module.guard_attempts(result,state)['run'])
        self.assertTrue(module.guard_attempts({'run':True,'target':'2026-11-06T11:30:00+08:00'},state)['run'])
        pool={'stocks':[{'code':'600519'}]};now=dt.datetime.fromisoformat('2026-11-06T10:45:00+08:00');target='2026-11-06T10:30:00+08:00'
        snapshot={'rule':'old','results':{'600519':{'checked_session':target,'hourly_as_of':target}}}
        self.assertTrue(module.scan_due(snapshot,pool,now,'current')['run'])

        snapshot['rule']='current';self.assertTrue(module.scan_due(snapshot,pool,now,'current','new-source')['run'])

class BoundedWaitTests(unittest.TestCase):
    def test_process_clock_reaches_slot_without_an_external_event(self):
        import datetime,os,runpy,sys,tempfile
        from unittest.mock import patch
        original=datetime.datetime
        class Clock(original):
            current=original.fromisoformat('2026-11-06T14:04:50+08:00')
            @classmethod
            def now(cls,tz=None):return cls.current.astimezone(tz) if tz else cls.current
        sleeps=[]
        def advance(seconds):sleeps.append(seconds);Clock.current+=datetime.timedelta(seconds=seconds)
        script=Path(__file__).parent/'scripts/wait-update-slot.py'
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'output'
            with patch.dict(os.environ,{'GITHUB_OUTPUT':str(output)}),patch.object(sys,'argv',[str(script),'--slot','14:05']),patch('datetime.datetime',Clock),patch('time.sleep',advance):
                runpy.run_path(str(script),run_name='__main__')
            self.assertEqual(output.read_text(),'ready=true\n');self.assertEqual(sum(sleeps),10)
    def test_expired_watch_does_not_collect(self):
        import datetime,os,runpy,sys,tempfile
        from unittest.mock import patch
        original=datetime.datetime
        class Clock(original):
            @classmethod
            def now(cls,tz=None):return original.fromisoformat('2026-11-06T15:21:00+08:00').astimezone(tz)
        script=Path(__file__).parent/'scripts/wait-update-slot.py'
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'output'
            with patch.dict(os.environ,{'GITHUB_OUTPUT':str(output)}),patch.object(sys,'argv',[str(script),'--slot','15:05']),patch('datetime.datetime',Clock),patch('time.sleep') as sleep:
                runpy.run_path(str(script),run_name='__main__')
            self.assertEqual(output.read_text(),'ready=false\n');sleep.assert_not_called()
