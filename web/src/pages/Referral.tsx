import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Referral() {
  const [info, setInfo] = useState({ code: '', count: 0, commission: 0.1 });
  const [lead, setLead] = useState<{ name: string; balance: number; totalAds: number }[]>([]);

  useEffect(() => {
    api.referral().then(setInfo).catch(() => {});
    api.leaderboard().then(setLead).catch(() => {});
  }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(info.code); alert('copied ' + info.code); }
    catch { prompt('copy:', info.code); }
  };

  return (
    <div className="sec">
      <div className="card"><h3>Referral (10% commission)</h3>
        Code: <b>{info.code}</b> <button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={copy}>Copy</button>
        <br />Friends: {info.count} | {(info.commission * 100).toFixed(0)}%
      </div>
      <div className="card"><h3>Leaderboard</h3>
        {lead.map((x, i) => <div className="listrow" key={i}><span>{i + 1}. {x.name} <small>{x.totalAds} ads</small></span><b>${x.balance}</b></div>)}
      </div>
    </div>
  );
}
