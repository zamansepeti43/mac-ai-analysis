import { NextResponse } from "next/server";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const ESPN_LEAGUES = [
  ["eng.1","İngiltere","Premier League"],["tur.1","Türkiye","Süper Lig"],["esp.1","İspanya","La Liga"],["ita.1","İtalya","Serie A"],["ger.1","Almanya","Bundesliga"],["fra.1","Fransa","Ligue 1"],["ned.1","Hollanda","Eredivisie"],["por.1","Portekiz","Primeira Liga"],["sco.1","İskoçya","Premiership"],["usa.1","ABD","MLS"],["bel.1","Belçika","Pro League"],["aut.1","Avusturya","Bundesliga"],["sui.1","İsviçre","Super League"],["gre.1","Yunanistan","Super League"],["den.1","Danimarka","Superliga"],["nor.1","Norveç","Eliteserien"],["swe.1","İsveç","Allsvenskan"],["bra.1","Brezilya","Serie A"],["arg.1","Arjantin","Liga Profesional"],["mex.1","Meksika","Liga MX"],["jpn.1","Japonya","J1 League"],["kor.1","Güney Kore","K League 1"],["aus.1","Avustralya","A-League"],["uefa.champions","Avrupa","UEFA Şampiyonlar Ligi"],["uefa.europa","Avrupa","UEFA Avrupa Ligi"],["uefa.europa.conf","Avrupa","UEFA Konferans Ligi"]
] as const;

type AnyRecord = Record<string, any>;
type LiveFixture = { id:number; starting_at?:string; league?:{name?:string;country?:{name?:string}}; participants?:AnyRecord[]; scores?:AnyRecord[]; statistics?:AnyRecord[]; periods?:AnyRecord[] };
type ApiFootballFixture = { fixture:{id:number;date:string;status:{short:string;elapsed?:number|null}}; league:{name:string;country:string}; teams:{home:{id:number;name:string};away:{id:number;name:string}}; goals:{home:number|null;away:number|null} };
type ApiFootballStat = { team?:{id:number}; statistics?:Array<{type?:string;value?:number|string|null}> };
type EspnEvent = { id:string;date:string;competitions?:Array<{competitors?:Array<{homeAway?:"home"|"away";team?:{displayName?:string};score?:string}>;status?:{type?:{state?:string;shortDetail?:string;detail?:string}}}> };

function valueFromStats(stats:AnyRecord[], names:string[], location:string) {
  const wanted=names.map(x=>x.toLowerCase());
  const item=stats.find(row=>row.location===location && wanted.some(name=>`${row.type?.name??""} ${row.type?.developer_name??""} ${row.type?.code??""}`.toLowerCase().includes(name)));
  const value=item?.data?.value;
  if(typeof value==="number") return value;
  if(typeof value==="string") return Number(value.replace("%",""))||0;
  return 0;
}
function participants(fixture:LiveFixture){const list=fixture.participants??[];return{home:list.find(p=>p.meta?.location==="home")??list[0],away:list.find(p=>p.meta?.location==="away")??list[1]};}
function scoreFor(fixture:LiveFixture,location:"home"|"away"){const row=(fixture.scores??[]).find(x=>x.score?.participant===location&&typeof x.score?.goals==="number"&&(x.description==="CURRENT"||!x.description));return typeof row?.score?.goals==="number"?row.score.goals:0;}
function minuteFrom(fixture:LiveFixture){const periods=fixture.periods??[];const current=periods.find(p=>p.is_current)??periods[periods.length-1];const minute=Number(current?.minutes??current?.minute??0);return Number.isFinite(minute)?Math.max(0,Math.min(120,minute)):0;}
function liveProbability(stats:AnyRecord[],minute:number){
  const hs=valueFromStats(stats,["shots","total shots"],"home"), as=valueFromStats(stats,["shots","total shots"],"away");
  const ho=valueFromStats(stats,["shots on target","on target"],"home"), ao=valueFromStats(stats,["shots on target","on target"],"away");
  const hp=valueFromStats(stats,["ball possession","possession"],"home"), ap=valueFromStats(stats,["ball possession","possession"],"away");
  const hc=valueFromStats(stats,["corners"],"home"), ac=valueFromStats(stats,["corners"],"away");
  const hb=valueFromStats(stats,["big chances"],"home"), ab=valueFromStats(stats,["big chances"],"away");
  const totalShots=hs+as,totalOn=ho+ao,totalCorners=hc+ac,totalBig=hb+ab;
  const intensity=Math.min(1.9,0.15+totalShots*.035+totalOn*.11+totalCorners*.018+totalBig*.16+(Math.abs(hp-ap)<18?.08:0));
  const remaining=Math.max(0,Math.min(60,90-Math.min(90,minute))),lambda=intensity*(remaining/45);
  const nextGoal=Math.round((1-Math.exp(-lambda))*100);
  return {nextGoal:Math.max(1,Math.min(99,nextGoal)),shots:totalShots,shotsOnTarget:totalOn,corners:totalCorners,bigChances:totalBig,possession:{home:Math.round(hp),away:Math.round(ap)},signal:nextGoal>=65?"Güçlü gol sinyali":nextGoal>=45?"Orta gol sinyali":"Düşük gol sinyali",explanation:`Canlı model ${Math.floor(minute)}. dakika verisini şut, isabetli şut, korner, büyük şans ve topa sahip olma ile değerlendiriyor.`};
}
function basicLiveAnalysis(minute:number){return{nextGoal:50,shots:0,shotsOnTarget:0,corners:0,bigChances:0,possession:{home:50,away:50},signal:"Canlı veri alındı",explanation:`Canlı maç ${Math.floor(minute)}. dakikada. Detaylı istatistik sağlayıcıdan bekleniyor.`};}

async function getSportmonksFixtures(){
  const token=process.env.SPORTMONKS_API_TOKEN;if(!token)return[] as LiveFixture[];
  try{const response=await fetch(`${SPORTMONKS_URL}/livescores/inplay?include=participants;league;scores;events;statistics;periods;xgfixture&per_page=100`,{headers:{Authorization:token},cache:"no-store"});if(!response.ok)return[];const json=await response.json() as {data?:LiveFixture[]};return json.data??[];}catch{return[] as LiveFixture[];}
}
async function apiFootball<T>(path:string){const key=process.env.API_FOOTBALL_KEY;if(!key)return[] as T[];try{const response=await fetch(`${API_FOOTBALL_URL}${path}`,{headers:{"x-apisports-key":key},cache:"no-store"});if(!response.ok)return[];const json=await response.json() as {response?:T[]};return json.response??[];}catch{return[] as T[];}}
async function getApiFootballFixtures(){return apiFootball<ApiFootballFixture>(`/fixtures?live=all`);}
function apiStatsToModel(rows:ApiFootballStat[],homeId:number,awayId:number,minute:number){
  const stats:AnyRecord[]=[];
  for(const row of rows){const location=row.team?.id===homeId?"home":row.team?.id===awayId?"away":null;if(!location)continue;for(const item of row.statistics??[])stats.push({location,type:{name:item.type??""},data:{value:item.value}});}
  return liveProbability(stats,minute);
}
async function mapApiFootball(item:ApiFootballFixture){
  const minute=item.fixture.status.elapsed??0;
  const stats=await apiFootball<ApiFootballStat>(`/fixtures/statistics?fixture=${item.fixture.id}`);
  const analysis=stats.length?apiStatsToModel(stats,item.teams.home.id,item.teams.away.id,minute):basicLiveAnalysis(minute);
  return{id:item.fixture.id,league:item.league.name,country:item.league.country,home:item.teams.home.name,away:item.teams.away.name,minute,status:`${Math.floor(minute)}'`,homeScore:item.goals.home??0,awayScore:item.goals.away??0,...analysis};
}
async function getEspnFixtures(){
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date()).replaceAll("-","");
  const responses=await Promise.all(ESPN_LEAGUES.map(async([code,country,league])=>{try{const response=await fetch(`${ESPN_URL}/${code}/scoreboard?dates=${today}`,{cache:"no-store"});if(!response.ok)return[];const json=await response.json() as {events?:EspnEvent[]};return(json.events??[]).filter(e=>e.competitions?.[0]?.status?.type?.state==="in").map(event=>({event,country,league}));}catch{return[];}}));return responses.flat();
}
function mapSportmonks(fixture:LiveFixture){const{home,away}=participants(fixture);const minute=minuteFrom(fixture);return{id:fixture.id,league:fixture.league?.name??"Lig bilgisi bekleniyor",country:fixture.league?.country?.name??"",home:home?.name??"Ev sahibi",away:away?.name??"Deplasman",minute,status:`${Math.floor(minute)}'`,homeScore:scoreFor(fixture,"home"),awayScore:scoreFor(fixture,"away"),...liveProbability(fixture.statistics??[],minute)};}
function mapEspn(item:{event:EspnEvent;country:string;league:string}){const c=item.event.competitions?.[0],competitors=c?.competitors??[];const home=competitors.find(x=>x.homeAway==="home"),away=competitors.find(x=>x.homeAway==="away");const detail=c?.status?.type?.shortDetail??c?.status?.type?.detail??"CANLI";return{id:Number(`9${item.event.id}`.slice(-9)),league:item.league,country:item.country,home:home?.team?.displayName??"Ev sahibi",away:away?.team?.displayName??"Deplasman",minute:0,status:detail,homeScore:Number(home?.score??0),awayScore:Number(away?.score??0),...basicLiveAnalysis(0)};}

export async function GET(){
  const sportmonks=await getSportmonksFixtures();
  if(sportmonks.length)return NextResponse.json({source:"sportmonks",updatedAt:new Date().toISOString(),live:sportmonks.map(mapSportmonks),count:sportmonks.length});
  const apiFootball=await getApiFootballFixtures();
  if(apiFootball.length){const live=await Promise.all(apiFootball.slice(0,30).map(mapApiFootball));return NextResponse.json({source:"api-football",updatedAt:new Date().toISOString(),live,fallback:true,count:live.length});}
  const espn=await getEspnFixtures();
  if(espn.length)return NextResponse.json({source:"espn",updatedAt:new Date().toISOString(),live:espn.map(mapEspn),fallback:true,count:espn.length});
  return NextResponse.json({source:"none",updatedAt:new Date().toISOString(),live:[],count:0,message:"Canlı veri sağlayıcılarında şu anda canlı maç bulunamadı."});
}
