import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useAuth } from '../lib/auth';

const COUNTRIES: [string, string][] = [['AF','Afghanistan'],['AL','Albania'],['DZ','Algeria'],['AD','Andorra'],['AO','Angola'],['AG','Antigua and Barbuda'],['AR','Argentina'],['AM','Armenia'],['AU','Australia'],['AT','Austria'],['AZ','Azerbaijan'],['BS','Bahamas'],['BH','Bahrain'],['BD','Bangladesh'],['BB','Barbados'],['BY','Belarus'],['BE','Belgium'],['BZ','Belize'],['BJ','Benin'],['BT','Bhutan'],['BO','Bolivia'],['BA','Bosnia and Herzegovina'],['BW','Botswana'],['BR','Brazil'],['BN','Brunei'],['BG','Bulgaria'],['BF','Burkina Faso'],['BI','Burundi'],['CV','Cabo Verde'],['KH','Cambodia'],['CM','Cameroon'],['CA','Canada'],['CF','Central African Republic'],['TD','Chad'],['CL','Chile'],['CN','China'],['CO','Colombia'],['KM','Comoros'],['CG','Congo'],['CR','Costa Rica'],['HR','Croatia'],['CU','Cuba'],['CY','Cyprus'],['CZ','Czechia'],['DK','Denmark'],['DJ','Djibouti'],['DM','Dominica'],['DO','Dominican Republic'],['EC','Ecuador'],['EG','Egypt'],['SV','El Salvador'],['GQ','Equatorial Guinea'],['ER','Eritrea'],['EE','Estonia'],['SZ','Eswatini'],['ET','Ethiopia'],['FJ','Fiji'],['FI','Finland'],['FR','France'],['GA','Gabon'],['GM','Gambia'],['GE','Georgia'],['DE','Germany'],['GH','Ghana'],['GR','Greece'],['GD','Grenada'],['GT','Guatemala'],['GN','Guinea'],['GW','Guinea-Bissau'],['GY','Guyana'],['HT','Haiti'],['HN','Honduras'],['HU','Hungary'],['IS','Iceland'],['IN','India'],['ID','Indonesia'],['IR','Iran'],['IQ','Iraq'],['IE','Ireland'],['IL','Israel'],['IT','Italy'],['JM','Jamaica'],['JP','Japan'],['JO','Jordan'],['KZ','Kazakhstan'],['KE','Kenya'],['KI','Kiribati'],['KP','North Korea'],['KR','South Korea'],['KW','Kuwait'],['KG','Kyrgyzstan'],['LA','Laos'],['LV','Latvia'],['LB','Lebanon'],['LS','Lesotho'],['LR','Liberia'],['LY','Libya'],['LI','Liechtenstein'],['LT','Lithuania'],['LU','Luxembourg'],['MG','Madagascar'],['MW','Malawi'],['MY','Malaysia'],['MV','Maldives'],['ML','Mali'],['MT','Malta'],['MH','Marshall Islands'],['MR','Mauritania'],['MU','Mauritius'],['MX','Mexico'],['FM','Micronesia'],['MD','Moldova'],['MC','Monaco'],['MN','Mongolia'],['ME','Montenegro'],['MA','Morocco'],['MZ','Mozambique'],['MM','Myanmar'],['NA','Namibia'],['NR','Nauru'],['NP','Nepal'],['NL','Netherlands'],['NZ','New Zealand'],['NI','Nicaragua'],['NE','Niger'],['NG','Nigeria'],['MK','North Macedonia'],['NO','Norway'],['OM','Oman'],['PK','Pakistan'],['PW','Palau'],['PS','Palestine'],['PA','Panama'],['PG','Papua New Guinea'],['PY','Paraguay'],['PE','Peru'],['PH','Philippines'],['PL','Poland'],['PT','Portugal'],['QA','Qatar'],['RO','Romania'],['RU','Russia'],['RW','Rwanda'],['KN','Saint Kitts and Nevis'],['LC','Saint Lucia'],['VC','Saint Vincent and the Grenadines'],['WS','Samoa'],['SM','San Marino'],['ST','Sao Tome and Principe'],['SA','Saudi Arabia'],['SN','Senegal'],['RS','Serbia'],['SC','Seychelles'],['SL','Sierra Leone'],['SG','Singapore'],['SK','Slovakia'],['SI','Slovenia'],['SB','Solomon Islands'],['SO','Somalia'],['ZA','South Africa'],['SS','South Sudan'],['ES','Spain'],['LK','Sri Lanka'],['SD','Sudan'],['SR','Suriname'],['SE','Sweden'],['CH','Switzerland'],['SY','Syria'],['TW','Taiwan'],['TJ','Tajikistan'],['TZ','Tanzania'],['TH','Thailand'],['TL','Timor-Leste'],['TG','Togo'],['TO','Tonga'],['TT','Trinidad and Tobago'],['TN','Tunisia'],['TR','Turkey'],['TM','Turkmenistan'],['TV','Tuvalu'],['UG','Uganda'],['UA','Ukraine'],['AE','United Arab Emirates'],['GB','United Kingdom'],['US','United States'],['UY','Uruguay'],['UZ','Uzbekistan'],['VU','Vanuatu'],['VA','Vatican City'],['VE','Venezuela'],['VN','Vietnam'],['YE','Yemen'],['ZM','Zambia'],['ZW','Zimbabwe'],['CD','Democratic Republic of the Congo'],['CI','Ivory Coast'],['CZ','Czech Republic'],['TL','East Timor'],['VA','Holy See'],['IR','Iran'],['LA','Laos'],['MD','Moldova'],['RU','Russian Federation'],['SY','Syrian Arab Republic'],['TW','Taiwan'],['TZ','Tanzania'],['GB','United Kingdom of Great Britain'],['US','United States of America'],['VN','Vietnam'],['PS','State of Palestine'],['XK','Kosovo']];

function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const sel = COUNTRIES.find(c => c[0] === value);
  const list = COUNTRIES.filter(c => (c[0] + ' ' + c[1]).toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div>
      <button type="button" className="btn btn2" onClick={() => { setOpen(!open); setQ(''); }}>
        {sel ? sel[1] + ' (' + sel[0] + ')' : 'Select country'}
      </button>
      {open && (
        <div style={{ border: '1px solid #e3dcff', borderRadius: 12, marginTop: 6, background: '#fff', overflow: 'hidden' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search country..." autoFocus />
          <div style={{ maxHeight: 170, overflowY: 'auto' }}>
            {list.map(([code, name]) => (
              <div key={code} onClick={() => { onChange(code); setOpen(false); }}
                style={{ padding: '9px 11px', cursor: 'pointer', background: code === value ? '#f1ebff' : undefined, fontSize: 14 }}>
                {name} <span className="small">({code})</span>
              </div>
            ))}
            {list.length === 0 && <div className="small" style={{ padding: 10 }}>No match</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Signup() {
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  // step 1: profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('BD');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  // step 2: account
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ref, setRef] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (!loading && user) nav('/dashboard', { replace: true }); }, [user, loading, nav]);

  const next = () => {
    if (!firstName.trim()) return setErr('First name required');
    if (!lastName.trim()) return setErr('Last name required');
    if (!country.trim()) return setErr('Country required');
    if (!city.trim()) return setErr('City required');
    if (!zip.trim()) return setErr('Zip code required');
    setErr('');
    setStep(2);
  };

  const go = async () => {
    setErr('Creating account...');
    try {
      const r = await api.signup({
        firstName: firstName.trim(), lastName: lastName.trim(),
        country: country.trim(), city: city.trim(), zip: zip.trim(),
        username: username.trim(), birthday, email: email.trim(),
        password, referralCode: ref.trim() || undefined,
      });
      setToken(r.token);
      await refresh();
      nav('/dashboard');
    } catch (e) { setErr(e instanceof Error ? e.message : 'failed'); }
  };

  return (
    <div className="gate"><div className="gbox">
      <div style={{ fontSize: 44 }}>$</div><h2>Else</h2>
      <div style={{ display: 'flex', gap: 6 }}><Link to="/login" className="btn btn2" style={{ textAlign: 'center', textDecoration: 'none' }}>Login</Link><span className="btn" style={{ textAlign: 'center' }}>Signup</span></div>
      <div className="small">Step {step} of 2 - {step === 1 ? 'your profile' : 'your account'}</div>
      {step === 1 ? (
        <div style={{ textAlign: 'left' }}>
          First name<input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" />
          Last name<input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
          Country<CountrySelect value={country} onChange={setCountry} />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>City<input value={city} onChange={e => setCity(e.target.value)} placeholder="Dhaka" /></div>
            <div style={{ flex: 1 }}>Zip code<input value={zip} onChange={e => setZip(e.target.value)} placeholder="1200" /></div>
          </div>
          <div className="small" style={{ color: '#ff5c8a', minHeight: 16 }}>{err}</div>
          <button className="btn" onClick={next}>Continue</button>
          <div className="small" style={{ marginTop: 8 }}>Already have an account? <Link to="/login">Log in</Link></div>
        </div>
      ) : (
        <div style={{ textAlign: 'left' }}>
          Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="john_12 (3-20, a-z 0-9 _)" autoComplete="username" />
          Birthday<input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
          Email<input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@mail.com" autoComplete="email" />
          Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 6 chars" autoComplete="new-password" />
          Referral (optional)<input value={ref} onChange={e => setRef(e.target.value)} placeholder="ELSE-XXXXXX" />
          <div className="small" style={{ color: '#ff5c8a', minHeight: 16 }}>{err}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn2" style={{ width: 110 }} onClick={() => { setErr(''); setStep(1); }}>Back</button>
            <button className="btn" onClick={go}>Create account</button>
          </div>
        </div>
      )}
    </div></div>
  );
}
