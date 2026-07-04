#!/usr/bin/env python3
"""Rebuild index.html with 7 stocks embedded"""
import json, pandas as pd, os

DATA_DIR = '../data'
stocks = [
    ('600703.SH', '三安光电'),
    ('002202.SZ', '金风科技'),
    ('688333.SH', '铂力特'),
    ('300136.SZ', '信维通信'),
    ('688017.SH', '绿的谐波'),
    ('603986.SH', '兆易创新'),
    ('300223.SZ', '北京君正'),
]

# Load all stocks data
all_data = {}
default_code = '600703.SH'
for code, name in stocks:
    num = code.split('.')[0]
    csv_path = os.path.join(DATA_DIR, f'{num}_{name}.csv')
    if not os.path.exists(csv_path):
        csv_path = os.path.join(DATA_DIR, 'sanan_daily.csv')  # fallback
    df = pd.read_csv(csv_path)
    df = df.sort_values('trade_date')
    data = [[r['trade_date'], float(r['open']), float(r['high']), float(r['low']), float(r['close']), float(r['vol'])] for _, r in df.iterrows()]
    all_data[code] = data
    print(f'  Loaded {name} ({code}): {len(data)} rows')

# Default stock data for initial display
default_data = all_data[default_code]
data_json = json.dumps(all_data, separators=(',', ':'))

latest = default_data[-1]
prev = default_data[-2]
last_price = latest[4]
change_pct = (latest[4] - prev[4]) / prev[4] * 100
date_first = default_data[0][0]
date_last = default_data[-1][0]

stocks_json = json.dumps([{'code': c, 'name': n} for c, n in stocks], ensure_ascii=False)
default_code_json = json.dumps(default_code)

css = open('css/style.css').read()

H = []
H.append('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">')
H.append('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
H.append('<title>Stock Indicator Lab</title>')
H.append('<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>')
H.append('<style>' + css + '''
.chart-wrap-lg{position:relative;height:480px;width:100%}
.chart-ind{position:relative;height:260px;width:100%}
.panel-row{position:relative;min-height:280px}
.panel-left{position:absolute;left:0;top:0;bottom:0;width:180px;padding:12px 10px;border-right:1px solid var(--border);background:var(--bg2);overflow-y:auto;box-sizing:border-box;z-index:2}
.panel-right{width:100%;padding:8px 12px 8px 200px;box-sizing:border-box}
.panel-right>div{width:100%!important;box-sizing:border-box}
.panel-left .ctrl-block{margin-bottom:12px}
.panel-left .ctrl-block label{display:block;font-size:12px;color:var(--text2);font-weight:600;margin-bottom:4px}
.panel-left .ctrl-block input[type=range]{width:100%;accent-color:var(--accent)}
.btn-reset-sm{display:block;width:100%;padding:6px;margin-top:8px;font-size:11px}
@media(max-width:700px){.panel-row{position:static}.panel-left{position:static;width:100%;border-right:none;border-bottom:1px solid var(--border)}.panel-right{padding:8px 12px}}

.panel-left .ctrl-block{margin-bottom:12px}
.panel-left .ctrl-block label{display:block;font-size:12px;color:var(--text2);font-weight:600;margin-bottom:4px}
.panel-left .ctrl-block input[type=range]{width:100%;accent-color:var(--accent)}
.panel-left .ctrl-block input[type=number]{width:60px;padding:3px 5px;border:2px solid var(--border);border-radius:4px;font-size:12px;text-align:center;outline:none}
.panel-left .ctrl-block input[type=number]:focus{border-color:var(--accent)}
.btn-reset-sm{display:block;width:100%;padding:6px;margin-top:8px;font-size:11px}
</style></head><body><div class="container">''')

# Header
H.append('<div class="header"><h1>Stock Indicator Lab</h1><span class="badge">v7</span>')
H.append('<button class="btn btn-reset" onclick="resetAll()">Reset All</button></div>')
H.append('<div class="data-bar" id="dataBar">---</div>')

# K-line with stock info sidebar
H.append('<div class="panel" style="margin-bottom:12px">')
H.append('<div class="panel-header" onclick="togglePanel(&#39;kline&#39;)"><span class="collapse-arrow" id="arrow-kline">v</span><h3>K-line &amp; MA &amp; Volume</h3></div>')
H.append('<div class="panel-body" id="body-kline">')
H.append('<div class="panel-row">')
H.append('<div class="panel-left">')
H.append('<div class="stock-card">')
H.append('<h4>选择股票</h4>')
H.append('<select style="width:100%;padding:6px;border-radius:4px;border:1px solid var(--border);font-size:12px" id="stockSelect" onchange="onStockChange()">')
for code, name in stocks:
    H.append('<option value="'+code+'"' + (' selected' if code==default_code else '') + '>'+name+' '+code+'</option>')
H.append('</select>')
H.append('<div style="margin:10px 0"><span style="font-size:24px;font-weight:700" id="stkPrice">'+str(last_price)+'</span> <span class="'+('up' if change_pct>=0 else 'down')+'" id="stkChg" style="font-size:14px;font-weight:600;'+('color:#e74c3c' if change_pct>=0 else 'color:#27ae60')+'">'+('+' if change_pct>=0 else '')+str(round(change_pct,2))+'%</span></div>')
H.append('<div style="margin:10px 0"><span style="font-weight:700;font-size:16px">日期范围</span></div>')
H.append('<div style="margin-bottom:4px"><input type="date" id="dateStart" value="'+date_first+'" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:4px;font-size:11px" onchange="applyDateFilter()"></div>')
H.append('<div style="margin-bottom:8px"><input type="date" id="dateEnd" value="'+date_last+'" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:4px;font-size:11px" onchange="applyDateFilter()"></div>')
H.append('<button class="btn btn-reset btn-sm" onclick="applyDateFilter()" style="width:100%">更新日期</button>')
H.append('</div>')
H.append('</div>')
H.append('<div class="panel-right"><div style="width:100%;height:480px" id="kline"></div></div>')
H.append('</div></div></div>')

# Indicator panels with left sidebar
panels = [
    ('rsi','RSI — Relative Strength Index', [('N','rsi-n',2,100,14,'redrawRSI()')]),
    ('macd','MACD', [('FAST','macd-fast',2,50,12,'redrawMACD()'),('SLOW','macd-slow',3,100,26,'redrawMACD()'),('SIG','macd-signal',2,30,9,'redrawMACD()')]),
    ('boll','BOLL — Bollinger Bands', [('N','boll-n',5,100,20,'redrawBOLL()'),('K','boll-k',1,4,2,'redrawBOLL()')]),
    ('atr','ATR — Average True Range', [('N','atr-n',2,100,14,'redrawATR()')]),
]

for pid, pname, params in panels:
    H.append('<div class="panel" style="margin-bottom:12px">')
    H.append('<div class="panel-header" onclick="togglePanel(&#39;'+pid+'&#39;)"><span class="collapse-arrow" id="arrow-'+pid+'">v</span><h3>'+pname+'</h3></div>')
    H.append('<div class="panel-body" id="body-'+pid+'">')
    H.append('<div class="panel-row">')
    H.append('<div class="panel-left">')
    for label, sid, mn, mx, val, onchange in params:
        step_attr = ' step="0.1"' if (pid == 'boll' and label == 'K') else ''
        H.append('<div class="ctrl-block">')
        H.append('<label>'+label+' = <span id="'+sid+'-label">'+str(val)+'</span></label>')
        H.append('<input type="range" id="'+sid+'" min="'+str(mn)+'" max="'+str(mx)+'" value="'+str(val)+'"'+step_attr+' oninput="onSlider(\''+sid+'\',\''+sid+'-label\','+onchange.replace('()','')+')">')
        H.append('</div>')
    H.append('<button class="btn btn-reset btn-reset-sm" onclick="reset'+pid.upper()+'()">Reset</button>')
    H.append('</div>')
    H.append('<div class="panel-right">')
    H.append('<div style="width:100%;height:260px" id="'+pid+'"></div>')
    H.append('<div class="status-bar" id="'+pid+'-bar">---</div>')
    H.append('</div>')
    H.append('</div></div></div>')

H.append('</div></div>')

# Data
H.append('<script>var ALL_DATA='+data_json+'; var RAW_DATA=ALL_DATA["'+default_code+'"]; var FULL_DATA=RAW_DATA; var STOCKS='+stocks_json+'; var CUR_CODE="'+default_code+'";</script>')

# JS
js = """
var D=RAW_DATA.map(function(r){return r[0];});
var C=RAW_DATA.map(function(r){return r[4];});
var H=RAW_DATA.map(function(r){return r[2];});
var L=RAW_DATA.map(function(r){return r[3];});
var db=document.getElementById("dataBar");
db.textContent="三安光电 600703.SH | "+RAW_DATA.length+" rows | "+D[0]+" ~ "+D[D.length-1]+" | Close "+C[C.length-1].toFixed(2);

function wilder(series,N){
  var r=[],sum=0,v=0;
  for(var i=0;i<N&&i<series.length;i++){sum+=series[i];v++;}
  for(var i=0;i<N-1;i++)r[i]=0;r[N-1]=v?sum/v:0;
  for(var i=N;i<series.length;i++)r[i]=(r[i-1]*(N-1)+series[i])/N;
  return r;
}
function ema(series,N){var a=2/(N+1),r=[];r[0]=series[0];for(var i=1;i<series.length;i++)r[i]=series[i]*a+r[i-1]*(1-a);return r;}
function sma(series,N){var r=[];for(var i=0;i<N-1;i++)r[i]=0;for(var i=N-1;i<series.length;i++){var s=0;for(var j=i-N+1;j<=i;j++)s+=series[j];r[i]=s/N;}return r;}
function onSlider(sid,labelId,fn){var v=document.getElementById(sid).value;document.getElementById(labelId).textContent=v;if(fn)fn();}

function applyDateFilter(){
  var ds=document.getElementById("dateStart").value;
  var de=document.getElementById("dateEnd").value;
  if(!ds||!de) return;
  RAW_DATA=FULL_DATA.filter(function(r){return r[0]>=ds && r[0]<=de;});
  if(RAW_DATA.length===0){alert("No data in range");RAW_DATA=FULL_DATA;return;}
  D=RAW_DATA.map(function(r){return r[0];});
  C=RAW_DATA.map(function(r){return r[4];});
  H=RAW_DATA.map(function(r){return r[2];});
  L=RAW_DATA.map(function(r){return r[3];});
  var last=RAW_DATA[RAW_DATA.length-1];
  document.getElementById("stkPrice").textContent=last[4].toFixed(2);
  document.getElementById("dataBar").textContent=CUR_CODE+" | "+RAW_DATA.length+" rows | "+D[0]+" ~ "+D[D.length-1]+" | Close "+last[4].toFixed(2);
  redrawKLine();redrawRSI();redrawMACD();redrawBOLL();redrawATR();
}

function onStockChange(){
  var code=document.getElementById("stockSelect").value;
  if(code===CUR_CODE) return;
  CUR_CODE=code;
  RAW_DATA=ALL_DATA[code]||ALL_DATA["600703.SH"];
  FULL_DATA=RAW_DATA;
  document.getElementById("dateStart").value=D[0];
  document.getElementById("dateEnd").value=D[D.length-1];
  D=RAW_DATA.map(function(r){return r[0];});
  C=RAW_DATA.map(function(r){return r[4];});
  H=RAW_DATA.map(function(r){return r[2];});
  L=RAW_DATA.map(function(r){return r[3];});
  var last=RAW_DATA[RAW_DATA.length-1], prev=RAW_DATA[RAW_DATA.length-2];
  var pct=(last[4]-prev[4])/prev[4]*100;
  document.getElementById("stkPrice").textContent=last[4].toFixed(2);
  var chgEl=document.getElementById("stkChg");
  chgEl.textContent=(pct>=0?"+":"")+pct.toFixed(2)+"%";
  chgEl.style.color=pct>=0?"#e74c3c":"#27ae60";
  var stock=STOCKS.find(function(s){return s.code===code;});
  var n=stock?stock.name:code;
  document.getElementById("dataBar").textContent=n+" "+code+" | "+RAW_DATA.length+" rows | Close "+last[4].toFixed(2);
  redrawKLine();redrawRSI();redrawMACD();redrawBOLL();redrawATR();
}

function redrawRSI(){
  var N=+document.getElementById("rsi-n").value;
  var gains=[],losses=[],vals=[];
  for(var i=0;i<C.length;i++){gains[i]=0;losses[i]=0;}
  for(var i=1;i<C.length;i++){var d=C[i]-C[i-1];if(d>0)gains[i]=d;else losses[i]=-d;}
  var ag=wilder(gains,N),al=wilder(losses,N);
  for(var i=N;i<C.length;i++){if(al[i]===0)vals[i]=100;else vals[i]=100-100/(1+ag[i]/al[i]);}
  var show=vals.slice(N),dts=D.slice(N);
  echarts.init(document.getElementById("rsi")).setOption({tooltip:{trigger:"axis"},xAxis:{type:"category",data:dts,axisLabel:{formatter:function(v){return v.slice(5);}}},yAxis:{min:0,max:100},series:[{name:"RSI",type:"line",data:show,showSymbol:false,markLine:{silent:true,data:[{yAxis:70},{yAxis:30}]}}]},true);
  var last=show[show.length-1],s=last>70?"Overbought":last<30?"Oversold":last>50?"Bullish":"Bearish";
  document.getElementById("rsi-bar").innerHTML="RSI("+N+")=<b>"+last.toFixed(2)+"</b> "+s;
}

function redrawMACD(){
  var f=+document.getElementById("macd-fast").value,s=+document.getElementById("macd-slow").value,sig=+document.getElementById("macd-signal").value;
  var ef=ema(C,f),es=ema(C,s),diff=[],dea,m=[];
  for(var i=0;i<C.length;i++)diff[i]=ef[i]-es[i];
  dea=ema(diff,sig);
  for(var i=0;i<C.length;i++)m[i]=2*(diff[i]-dea[i]);
  var st=s+sig,d1=diff.slice(st),d2=dea.slice(st),d3=m.slice(st),dts=D.slice(st);
  echarts.init(document.getElementById("macd")).setOption({tooltip:{trigger:"axis"},xAxis:{type:"category",data:dts,axisLabel:{formatter:function(v){return v.slice(5);}}},yAxis:{scale:true},series:[{name:"MACD",type:"bar",data:d3.map(function(v){return{value:v,itemStyle:{color:v>=0?"#e74c3c":"#27ae60"}}})},{name:"DIFF",type:"line",data:d1,showSymbol:false,lineStyle:{color:"#e8b86d"}},{name:"DEA",type:"line",data:d2,showSymbol:false,lineStyle:{color:"#6c9bd2"}}]},true);
  document.getElementById("macd-bar").innerHTML="DIFF=<b>"+d1[d1.length-1].toFixed(3)+"</b> DEA=<b>"+d2[d2.length-1].toFixed(3)+"</b>";
}

function redrawBOLL(){
  var N=+document.getElementById("boll-n").value,K=+document.getElementById("boll-k").value;
  var mid=[],up=[],low=[];
  for(var i=0;i<N-1;i++){mid[i]=0;up[i]=0;low[i]=0;}
  for(var i=N-1;i<C.length;i++){var sum=0,sq=0;for(var j=i-N+1;j<=i;j++){sum+=C[j];sq+=C[j]*C[j];}var mv=sum/N,std=Math.sqrt(sq/N-mv*mv);mid[i]=mv;up[i]=mv+K*std;low[i]=mv-K*std;}
  var st=N-1,dts=D.slice(st),c=C.slice(st),u=up.slice(st),m=mid.slice(st),l=low.slice(st);
  echarts.init(document.getElementById("boll")).setOption({tooltip:{trigger:"axis"},xAxis:{type:"category",data:dts,axisLabel:{formatter:function(v){return v.slice(5);}}},yAxis:{scale:true},series:[{name:"Close",type:"line",data:c,showSymbol:false,lineStyle:{color:"#333"}},{name:"Upper",type:"line",data:u,showSymbol:false,lineStyle:{color:"#e377c2"}},{name:"Mid",type:"line",data:m,showSymbol:false,lineStyle:{color:"#17a2b8"}},{name:"Lower",type:"line",data:l,showSymbol:false,lineStyle:{color:"#e377c2"},areaStyle:{color:"rgba(100,149,237,0.05)"}}]},true);
  document.getElementById("boll-bar").innerHTML="Up="+u[u.length-1].toFixed(2)+" Mid="+m[m.length-1].toFixed(2)+" Lo="+l[l.length-1].toFixed(2);
}

function redrawATR(){
  var N=+document.getElementById("atr-n").value;
  var tr=[];for(var i=0;i<C.length;i++)tr[i]=0;
  for(var i=1;i<C.length;i++)tr[i]=Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1]));
  var atr=wilder(tr,N),dts=D.slice(N),a=atr.slice(N);
  echarts.init(document.getElementById("atr")).setOption({tooltip:{trigger:"axis"},xAxis:{type:"category",data:dts,axisLabel:{formatter:function(v){return v.slice(5);}}},yAxis:{scale:true},series:[{name:"ATR",type:"line",data:a,showSymbol:false,lineStyle:{color:"#fd7e14"},areaStyle:{color:"rgba(253,126,20,0.1)"}}]},true);
  document.getElementById("atr-bar").innerHTML="ATR("+N+")=<b>"+a[a.length-1].toFixed(3)+"</b>";
}

function redrawKLine(){
  var ma5=sma(C,5),ma10=sma(C,10),ma20=sma(C,20),ma60=sma(C,60),UP="#e74c3c",DN="#27ae60",kd=[],vd=[],m5=[],m10=[],m20=[],m60=[];
  for(var i=0;i<RAW_DATA.length;i++){var r=RAW_DATA[i];kd.push([r[1],r[4],r[3],r[2]]);vd.push({value:r[5]||0,itemStyle:{color:r[4]>=r[1]?UP:DN}});m5.push(ma5[i]);m10.push(ma10[i]);m20.push(ma20[i]);m60.push(ma60[i]);}
  echarts.init(document.getElementById("kline")).setOption({tooltip:{trigger:"axis",axisPointer:{type:"cross"}},legend:{data:["K","MA5","MA10","MA20","MA60"],top:5},grid:[{left:"8%",right:"3%",top:40,height:"55%"},{left:"8%",right:"3%",top:"72%",height:"22%"}],xAxis:[{type:"category",data:D,gridIndex:0,axisLabel:{show:false}},{type:"category",data:D,gridIndex:1}],yAxis:[{type:"value",gridIndex:0,scale:true,axisLabel:{formatter:function(v){return "\\u00a5"+v;}}},{type:"value",gridIndex:1,scale:true,axisLabel:{formatter:function(v){return v>=10000?(v/10000).toFixed(0)+"\\u4e07\\u624b":v;}}}],dataZoom:[{type:"inside",xAxisIndex:[0,1],start:60,end:100},{type:"slider",xAxisIndex:[0,1],bottom:5,height:20}],series:[{name:"K",type:"candlestick",xAxisIndex:0,yAxisIndex:0,data:kd,itemStyle:{color:UP,color0:DN,borderColor:UP,borderColor0:DN},markPoint:{data:[{type:"max"},{type:"min"}]}},{name:"MA5",type:"line",xAxisIndex:0,yAxisIndex:0,data:m5,smooth:true,showSymbol:false,lineStyle:{width:1,color:"#e8b86d"}},{name:"MA10",type:"line",xAxisIndex:0,yAxisIndex:0,data:m10,smooth:true,showSymbol:false,lineStyle:{width:1,color:"#6c9bd2"}},{name:"MA20",type:"line",xAxisIndex:0,yAxisIndex:0,data:m20,smooth:true,showSymbol:false,lineStyle:{width:1,color:"#e0596c"}},{name:"MA60",type:"line",xAxisIndex:0,yAxisIndex:0,data:m60,smooth:true,showSymbol:false,lineStyle:{width:1,color:"#7b5ba7"}},{name:"Vol",type:"bar",xAxisIndex:1,yAxisIndex:1,data:vd}]},true);
}

function togglePanel(id){document.getElementById("body-"+id).classList.toggle("collapsed");document.getElementById("arrow-"+id).classList.toggle("collapsed-arrow");}
function resetRSI(){document.getElementById("rsi-n").value=14;document.getElementById("rsi-n-label").textContent=14;redrawRSI();}
function resetMACD(){document.getElementById("macd-fast").value=12;document.getElementById("macd-fast-label").textContent=12;document.getElementById("macd-slow").value=26;document.getElementById("macd-slow-label").textContent=26;document.getElementById("macd-signal").value=9;document.getElementById("macd-signal-label").textContent=9;redrawMACD();}
function resetBOLL(){document.getElementById("boll-n").value=20;document.getElementById("boll-n-label").textContent=20;document.getElementById("boll-k").value=2;document.getElementById("boll-k-label").textContent=2;redrawBOLL();}
function resetATR(){document.getElementById("atr-n").value=14;document.getElementById("atr-n-label").textContent=14;redrawATR();}
function resetAll(){resetRSI();resetMACD();resetBOLL();resetATR();}
redrawKLine();redrawRSI();redrawMACD();redrawBOLL();redrawATR();
db.textContent+=" | All OK";
"""

H.append('<script>'+js+'</script>')
H.append('</body></html>')

with open('index.html', 'w') as f:
    f.write('\n'.join(H))
print(f'Done: {sum(len(p) for p in H)/1024:.1f}KB, {len(data)} rows')
