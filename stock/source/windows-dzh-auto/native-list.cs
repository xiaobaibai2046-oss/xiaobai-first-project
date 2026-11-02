// Read-only native ListView inspection. No mouse input, remote allocation or writes.
using System;
using System.Text;
using System.Runtime.InteropServices;
using Accessibility;
namespace Zhiheng {
    public sealed class NativeDzhCheck {
        public string Name;
        public uint StateImage;
        public int Index;
    }
    public static class DzhNativeList {
        [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        private static extern int GetClassName(IntPtr window, StringBuilder name, int maximum);
        [DllImport("user32.dll", SetLastError=true)]
        private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
        [DllImport("user32.dll", SetLastError=true)]
        private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam, uint flags, uint timeout, out UIntPtr result);
        [DllImport("oleacc.dll")]
        private static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId, ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out object accessible);
        private static uint ReadMessage(IntPtr window, uint message, uint index, uint mask) {
            UIntPtr result;
            if (SendMessageTimeout(window,message,new UIntPtr(index),new IntPtr((long)mask),3,1500,out result)==IntPtr.Zero)
                throw new InvalidOperationException("只读列表查询失败，系统错误 "+Marshal.GetLastWin32Error());
            if (result.ToUInt64()>UInt32.MaxValue) throw new InvalidOperationException("列表返回值超出范围");
            return (uint)result.ToUInt64();
        }
        private static string NormalName(string value) {
            if (value==null) return "";
            StringBuilder result=new StringBuilder(); bool space=false;
            foreach(char c in value.Replace("&","").Trim()) {
                if(Char.IsWhiteSpace(c)) { space=true; continue; }
                if(space && result.Length>0) result.Append(' ');
                result.Append(c);space=false;
            }
            return result.ToString();
        }
        // Pure checks, also exercised without Windows or any real handles.
        public static NativeDzhCheck[] Validate(string className,uint actualProcess,uint expectedProcess,uint extendedStyle,int nativeCount,int accessibleCount,string[] expectedNames,string[] actualNames,uint[] states) {
            return ValidateWithAccessibility(className,actualProcess,expectedProcess,extendedStyle,nativeCount,accessibleCount,expectedNames,actualNames,states,null);
        }
        public static NativeDzhCheck[] ValidateWithAccessibility(string className,uint actualProcess,uint expectedProcess,uint extendedStyle,int nativeCount,int accessibleCount,string[] expectedNames,string[] actualNames,uint[] states,uint[] accessibleStates) {
            if(!String.Equals(className,"SysListView32",StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("不是已支持的标准列表");
            if(expectedProcess==0 || actualProcess!=expectedProcess) throw new InvalidOperationException("列表进程不一致");
            bool nativeCheckbox=(extendedStyle & 4)!=0;
            bool checkedAnchor=false;
            if(!nativeCheckbox && accessibleStates!=null && accessibleStates.Length==nativeCount && expectedNames!=null && expectedNames.Length==nativeCount) {
                for(int i=0;i<nativeCount;i++) {
                    string n=NormalName(expectedNames[i]);
                    if(n.StartsWith("600809",StringComparison.Ordinal) && (n.Length==6 || !Char.IsDigit(n[6])) && (accessibleStates[i]&0x10)!=0 && (accessibleStates[i]&0x20)==0) checkedAnchor=true;
                }
            }
            if(!nativeCheckbox && !checkedAnchor) throw new InvalidOperationException("列表既无标准复选框样式，也无可验证的MSAA Checked标记，不能猜测状态");
            if(nativeCount<1 || nativeCount>10000 || accessibleCount!=nativeCount || expectedNames==null || actualNames==null || states==null || expectedNames.Length!=nativeCount || actualNames.Length!=nativeCount || states.Length!=nativeCount) throw new InvalidOperationException("列表数量或可访问项目不完整，停止");
            NativeDzhCheck[] result=new NativeDzhCheck[nativeCount];
            for(int i=0;i<nativeCount;i++) {
                if(NormalName(expectedNames[i]).Length==0 || !String.Equals(NormalName(expectedNames[i]),NormalName(actualNames[i]),StringComparison.Ordinal)) throw new InvalidOperationException("列表项目顺序或名称不一致，索引 "+i);
                uint image=(states[i] & 0xF000)>>12;
                if(image!=1 && image!=2) throw new InvalidOperationException("列表勾选图像状态未知，索引 "+i);
                if(!nativeCheckbox && (((accessibleStates[i]&0x20)!=0) || (((accessibleStates[i]&0x10)!=0)!=(image==2)))) throw new InvalidOperationException("MSAA与列表勾选图像矛盾，索引 "+i);
                result[i]=new NativeDzhCheck {Name=expectedNames[i],StateImage=image,Index=i};
            }
            return result;
        }
        public static NativeDzhCheck[] Read(IntPtr window,uint expectedProcess,string[] expectedNames) {
            if(window==IntPtr.Zero) throw new InvalidOperationException("列表窗口句柄无效");
            StringBuilder name=new StringBuilder(256);
            if(GetClassName(window,name,name.Capacity)==0) throw new InvalidOperationException("无法核实列表类别");
            uint process; if(GetWindowThreadProcessId(window,out process)==0 || process!=expectedProcess) throw new InvalidOperationException("列表所属进程已改变");
            if(!String.Equals(name.ToString(),"SysListView32",StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("不支持此列表类别");
            uint style=ReadMessage(window,0x1037,0,0); // LVM_GETEXTENDEDLISTVIEWSTYLE
            int count=checked((int)ReadMessage(window,0x1004,0,0)); // LVM_GETITEMCOUNT
            if(count<1 || count>10000 || expectedNames==null || expectedNames.Length!=count) throw new InvalidOperationException("完整项目数未核实；Style=0x"+style.ToString("X8")+", NativeCount="+count+", UIACount="+(expectedNames==null?0:expectedNames.Length));
            Guid iid=new Guid("618736E0-3C3D-11CF-810C-00AA00389B71"); object root;
            int hr=AccessibleObjectFromWindow(window,0xFFFFFFFC,ref iid,out root); // OBJID_CLIENT, IAccessible
            if(hr<0) Marshal.ThrowExceptionForHR(hr);
            IAccessible accessible=root as IAccessible;
            if(accessible==null) throw new InvalidOperationException("无法读取列表的可访问名称");
            int accessibleCount=accessible.accChildCount;
            if(accessibleCount!=count) throw new InvalidOperationException("列表可访问名称数量不完整，不能按索引猜测");
            string[] names=new string[count];uint[] states=new uint[count];
            uint[] accessibleStates=(style&4)==0?new uint[count]:null;
            for(int i=0;i<count;i++) {
                names[i]=accessible.get_accName(i+1); // Standard ListView MSAA child IDs are 1-based.
                if(accessibleStates!=null) accessibleStates[i]=Convert.ToUInt32(accessible.get_accState(i+1));
                states[i]=ReadMessage(window,0x102C,(uint)i,0xF000); // LVM_GETITEMSTATE, LVIS_STATEIMAGEMASK only
            }
            if((int)ReadMessage(window,0x1004,0,0)!=count) throw new InvalidOperationException("读取过程中列表数量改变，停止");
            uint currentProcess;GetWindowThreadProcessId(window,out currentProcess);
            return ValidateWithAccessibility(name.ToString(),currentProcess,expectedProcess,style,count,accessibleCount,expectedNames,names,states,accessibleStates);
        }
    }
}
