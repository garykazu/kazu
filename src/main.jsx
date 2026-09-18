import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, Bell, CalendarDays, ChevronDown, CircleHelp, Clock3, Command, LayoutDashboard, Menu, MoreHorizontal, Plus, Search, Settings, Sparkles, Target, Users, WalletCards, X, Zap} from 'lucide-react';
import './styles.css';

const deals = [
  {name:'Amplitude', owner:'MT', color:'#f08a72', value:'$84,000', stage:'Proposal', probability:80, close:'Sep 28', tone:'green'},
  {name:'Vercel', owner:'SK', color:'#7156d9', value:'$62,500', stage:'Negotiation', probability:65, close:'Oct 04', tone:'purple'},
  {name:'Linear', owner:'JD', color:'#4d77df', value:'$48,000', stage:'Discovery', probability:40, close:'Oct 12', tone:'blue'},
  {name:'Notion', owner:'AM', color:'#232323', value:'$35,000', stage:'Qualified', probability:25, close:'Oct 18', tone:'amber'},
];

const nav = [
  [LayoutDashboard,'Overview'], [WalletCards,'Pipeline'], [Target,'Forecast'], [Users,'Accounts']
];

function Logo(){return <div className="logo"><span><Zap size={17} fill="currentColor"/></span>Kazu</div>}

function App(){
  const [range,setRange]=useState('This quarter');
  const [search,setSearch]=useState(false);
  const [open,setOpen]=useState(false);
  const [toast,setToast]=useState('');
  const notify=(msg)=>{setToast(msg);setTimeout(()=>setToast(''),2400)};
  return <div className="app">
    <aside className={open?'open':''}>
      <div className="sideTop"><Logo/><button className="mobileClose" onClick={()=>setOpen(false)}><X size={19}/></button></div>
      <div className="workspace"><div className="avatar brand">KN</div><div><b>Kazu Note</b><small>Business plan</small></div><ChevronDown size={15}/></div>
      <nav><p>WORKSPACE</p>{nav.map(([Icon,label],i)=><button key={label} className={i===0?'active':''}><Icon size={18}/>{label}{label==='Pipeline'&&<em>12</em>}</button>)}</nav>
      <div className="sideBottom"><div className="upgrade"><Sparkles size={18}/><b>Unlock more insights</b><span>Upgrade to Pro for advanced forecasting.</span><button onClick={()=>notify('Upgrade request noted')}>Explore Pro</button></div><button className="plain"><CircleHelp size={18}/>Help & resources</button><button className="plain"><Settings size={18}/>Settings</button><div className="profile"><div className="avatar">MT</div><div><b>Maya Taylor</b><small>maya@kazunote.com</small></div><MoreHorizontal size={17}/></div></div>
    </aside>
    <main>
      <header><button className="mobileMenu" onClick={()=>setOpen(true)}><Menu/></button><div className={'search '+(search?'expanded':'')}><Search size={18}/><input autoFocus={search} onFocus={()=>setSearch(true)} onBlur={()=>setSearch(false)} placeholder="Search anything..."/><kbd>⌘ K</kbd></div><div className="headActions"><button className="iconBtn"><Bell size={18}/><i/></button><button className="primary" onClick={()=>notify('New deal workspace opened')}><Plus size={18}/>Add deal</button></div></header>
      <div className="content">
        <section className="welcome"><div><span className="eyebrow"><span/>MONDAY, SEPTEMBER 18</span><h1>Good morning, Maya.</h1><p>Here’s how your revenue is shaping up this quarter.</p></div><div className="range"><CalendarDays size={17}/><select value={range} onChange={e=>setRange(e.target.value)}><option>This quarter</option><option>Last quarter</option><option>This year</option></select></div></section>
        <section className="metrics">
          <Metric title="Pipeline value" value="$1.24M" delta="12.5%" sub="vs. last quarter" chart="line"/>
          <Metric title="Weighted forecast" value="$846K" delta="8.2%" sub="vs. last quarter" chart="bars"/>
          <Metric title="Closed won" value="$328K" delta="18.4%" sub="vs. last quarter" chart="steps"/>
          <Metric title="Win rate" value="32.8%" delta="3.1%" sub="vs. last quarter" chart="donut"/>
        </section>
        <section className="grid">
          <div className="card forecast"><div className="cardHead"><div><h2>Revenue forecast</h2><p>Actual and projected revenue</p></div><button className="dots"><MoreHorizontal/></button></div><div className="legend"><span><i className="actual"/>Actual</span><span><i className="projected"/>Projected</span><b>$846K <small>forecast</small></b></div><Chart/></div>
          <div className="card health"><div className="cardHead"><div><h2>Pipeline health</h2><p>Coverage against your target</p></div><button className="dots"><MoreHorizontal/></button></div><div className="gauge"><svg viewBox="0 0 180 105"><path d="M20 90a70 70 0 0 1 140 0" pathLength="100"/><path className="gaugeFill" d="M20 90a70 70 0 0 1 140 0" pathLength="100"/></svg><div><b>3.4<span>×</span></b><small>coverage</small></div></div><div className="healthStats"><div><span>Pipeline</span><b>$1.24M</b></div><div><span>Target</span><b>$365K</b></div><div><span>Gap</span><b className="positive">+$875K</b></div></div><div className="signal"><span><Sparkles size={15}/></span><p><b>Healthy coverage</b>You’re on track to hit your target.</p></div></div>
        </section>
        <section className="card deals"><div className="cardHead"><div><h2>Deals to watch</h2><p>High-impact opportunities closing soon</p></div><button className="view" onClick={()=>notify('Showing all deals')}>View all <ArrowUpRight size={15}/></button></div><div className="table"><div className="tr th"><span>DEAL</span><span>VALUE</span><span>STAGE</span><span>PROBABILITY</span><span>CLOSE DATE</span><span/></div>{deals.map(d=><div className="tr" key={d.name}><span className="deal"><i style={{background:d.color}}>{d.name[0]}</i><b>{d.name}</b><small>{d.owner}</small></span><b>{d.value}</b><span><mark className={d.tone}>{d.stage}</mark></span><span className="prob"><i><em style={{width:d.probability+'%'}}/></i>{d.probability}%</span><span className="date"><Clock3 size={15}/>{d.close}</span><button className="dots"><MoreHorizontal size={18}/></button></div>)}</div></section>
      </div>
    </main>{toast&&<div className="toast"><Command size={17}/>{toast}</div>}
  </div>
}

function Metric({title,value,delta,sub,chart}){return <div className="metric card"><span>{title}</span><div className="metricRow"><b>{value}</b><Mini type={chart}/></div><p><em>↗ {delta}</em> {sub}</p></div>}
function Mini({type}){if(type==='donut')return <div className="miniDonut"/>;if(type==='bars')return <div className="miniBars">{[35,48,43,66,58,84].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div>;return <svg className="mini" viewBox="0 0 100 45"><path className="area" d={type==='steps'?'M2 39 L18 34 L30 35 L42 25 L57 27 L70 13 L85 17 L98 4 L98 45 L2 45Z':'M2 38 C15 33 18 36 29 28 S43 29 51 21 S65 24 72 14 S87 15 98 4 L98 45 L2 45Z'}/><path d={type==='steps'?'M2 39 L18 34 L30 35 L42 25 L57 27 L70 13 L85 17 L98 4':'M2 38 C15 33 18 36 29 28 S43 29 51 21 S65 24 72 14 S87 15 98 4'}/></svg>}
function Chart(){return <div className="chart"><div className="axis"><span>$300K</span><span>$200K</span><span>$100K</span><span>$0</span></div><svg viewBox="0 0 700 210" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#725bd8" stopOpacity=".24"/><stop offset="1" stopColor="#725bd8" stopOpacity="0"/></linearGradient></defs><g className="gridlines"><path d="M0 20H700M0 75H700M0 130H700M0 185H700"/></g><path className="chartArea" d="M0 180 C50 168 68 163 112 151 S190 139 230 118 S302 110 345 83 L345 210H0Z"/><path className="chartLine" d="M0 180 C50 168 68 163 112 151 S190 139 230 118 S302 110 345 83"/><path className="chartDash" d="M345 83 C398 67 428 74 475 49 S552 47 591 26 S656 25 700 12"/><circle cx="345" cy="83" r="5"/></svg><div className="months"><span>JUL</span><span>AUG</span><span>SEP</span><span>OCT</span><span>NOV</span><span>DEC</span></div><div className="today">TODAY</div></div>}

createRoot(document.getElementById('root')).render(<App/>);
