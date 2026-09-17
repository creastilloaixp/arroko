// `customers` e `inventory` ya no viven aquí — los define ./data.js, generado
// por fixtures/build-demo-data.mjs a partir del SoftRestaurantAdapter real.
// Ver public/trinity-artifacts/arroko-crm/README.md.

const state={route:localStorage.getItem('arroko-crm-route')||'dashboard',segment:'all',stock:'all',dataMode:'fixtures'};
let customerRecords=[...customers];
let crmClient=null;

function createCrmClient(config){
  const storageKey='arroko-crm-session';
  let session=null;
  try{session=JSON.parse(localStorage.getItem(storageKey)||'null')}catch(_error){localStorage.removeItem(storageKey)}
  const saveSession=value=>{session=value||null;if(session)localStorage.setItem(storageKey,JSON.stringify(session));else localStorage.removeItem(storageKey)};
  const authHeaders=()=>({'apikey':config.supabaseAnonKey,'Authorization':`Bearer ${session?.access_token||config.supabaseAnonKey}`});
  async function authRequest(path,body){const response=await fetch(`${config.supabaseUrl}/auth/v1/${path}`,{method:'POST',headers:{'apikey':config.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok)return {data:{session:null},error:{message:payload.msg||payload.error_description||payload.message||'Error de autenticación'}};saveSession(payload);return {data:{session:payload},error:null}}
  async function currentSession(){if(session?.refresh_token&&Number(session.expires_at||0)*1000<Date.now()+60000){const refreshed=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});if(refreshed.error)saveSession(null)}return {data:{session},error:null}}
  class RestQuery{
    constructor(table){this.table=table;this.params=new URLSearchParams()}
    select(columns='*'){this.params.set('select',columns);return this}
    eq(column,value){this.params.append(column,`eq.${value}`);return this}
    in(column,values){this.params.append(column,`in.(${values.join(',')})`);return this}
    is(column,value){this.params.append(column,`is.${value}`);return this}
    or(expression){this.params.append('or',`(${expression})`);return this}
    order(column,options={}){this.params.set('order',`${column}.${options.ascending?'asc':'desc'}${options.nullsFirst===false?'.nullslast':''}`);return this}
    limit(value){this.params.set('limit',String(value));return this}
    async execute(){await currentSession();const response=await fetch(`${config.supabaseUrl}/rest/v1/${this.table}?${this.params}`,{headers:authHeaders()});const payload=await response.json().catch(()=>null);if(!response.ok)return {data:null,error:{code:payload?.code||String(response.status),message:payload?.message||'No se pudo consultar Supabase'}};return {data:payload,error:null}}
    then(resolve,reject){return this.execute().then(resolve,reject)}
  }
  return {from:table=>new RestQuery(table),auth:{getAccessToken:()=>session?.access_token||null,getSession:currentSession,signInWithPassword:({email,password})=>authRequest('token?grant_type=password',{email,password}),signOut:async()=>{if(session?.access_token)await fetch(`${config.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:authHeaders()}).catch(()=>null);saveSession(null);return {error:null}},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
}
const views=[...document.querySelectorAll('.view')];
const routeButtons=[...document.querySelectorAll('[data-route]')];
const navButtons=[...document.querySelectorAll('.nav-item,.mobile-nav button')];
const toast=document.querySelector('#toast');
let toastTimer;

function icon(id){return `<svg><use href="#${id}"/></svg>`}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function money(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(value)||0)}
function relativeDate(value){if(!value)return 'Sin visita';const date=new Date(value);if(Number.isNaN(date.getTime()))return 'Sin visita';const days=Math.floor((Date.now()-date.getTime())/86400000);if(days<=0)return `Hoy, ${date.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;if(days===1)return 'Ayer';return `Hace ${days} días`}
function showToast(message){toast.querySelector('span').textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
function setRoute(route){
  if(!document.querySelector(`#view-${route}`)) route='dashboard';
  state.route=route;localStorage.setItem('arroko-crm-route',route);
  views.forEach(view=>view.classList.toggle('active',view.id===`view-${route}`));
  navButtons.forEach(button=>button.classList.toggle('active',button.dataset.route===route));
  document.querySelector('#rokoContext').textContent=document.querySelector(`#view-${route}`).dataset.title;
  document.title=`${document.querySelector(`#view-${route}`).dataset.title} — Arroko Control`;
  window.scrollTo({top:0,behavior:'smooth'});
}
routeButtons.forEach(button=>button.addEventListener('click',()=>setRoute(button.dataset.route)));
document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>setRoute(button.dataset.jump)));

function renderCustomers(){
  const query=(document.querySelector('#customerSearch').value||'').toLowerCase();
  const filtered=customerRecords.filter(c=>(state.segment==='all'||c.status===state.segment)&&`${c.name} ${c.phone}`.toLowerCase().includes(query));
  document.querySelector('#customerRows').innerHTML=filtered.length?filtered.map(c=>`<tr data-client-id="${escapeHtml(c.id||'')}" tabindex="0"><td><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.phone)}</small></td><td>${escapeHtml(c.last)}</td><td>${escapeHtml(c.visits)}</td><td>${escapeHtml(c.ticket)}</td><td><span class="status-chip ${escapeHtml(c.status)}">${escapeHtml(c.label)}</span></td><td>${icon('i-chevron')}</td></tr>`).join(''):`<tr><td colspan="6">${state.dataMode==='live'?'Todavía no hay clientes visibles para esta cuenta.':'No hay clientes que coincidan con este filtro.'}</td></tr>`;
}
document.querySelectorAll('[data-segment]').forEach(button=>button.addEventListener('click',()=>{state.segment=button.dataset.segment;document.querySelectorAll('[data-segment]').forEach(b=>b.classList.toggle('active',b===button));renderCustomers()}));
document.querySelector('#customerSearch').addEventListener('input',renderCustomers);

function renderInventory(){
  const filtered=inventory.filter(item=>state.stock==='all'||item.status===state.stock);
  document.querySelector('#inventoryRows').innerHTML=filtered.map(item=>`<tr><td><strong>${item.name}</strong><small>Unidad: ${item.unit}</small></td><td><strong>${item.stock}</strong><div class="stock-meter"><i class="${item.status}" style="--stock:${item.level}%"></i></div></td><td>${item.coverage}</td><td>${item.cost}</td><td>${item.variation}</td><td><span class="status-chip ${item.status}">${item.label}</span></td></tr>`).join('');
}
document.querySelectorAll('[data-stock]').forEach(button=>button.addEventListener('click',()=>{state.stock=button.dataset.stock;document.querySelectorAll('[data-stock]').forEach(b=>b.classList.toggle('active',b===button));renderInventory()}));
document.querySelector('#showCriticalStock').addEventListener('click',()=>{state.stock='critical';document.querySelectorAll('[data-stock]').forEach(b=>b.classList.toggle('active',b.dataset.stock==='critical'));renderInventory()});

const metricPaths={
  sales:['M0 178 C70 152 90 92 150 108 S250 166 305 122 S390 64 455 80 S560 135 610 94 S700 32 760 54','M0 178 C70 152 90 92 150 108 S250 166 305 122 S390 64 455 80 S560 135 610 94 S700 32 760 54 V220H0Z'],
  orders:['M0 152 C70 162 95 118 150 124 S245 128 305 96 S390 115 455 98 S545 72 610 84 S700 65 760 74','M0 152 C70 162 95 118 150 124 S245 128 305 96 S390 115 455 98 S545 72 610 84 S700 65 760 74 V220H0Z'],
  ticket:['M0 112 C80 90 100 134 150 121 S245 80 305 94 S390 142 455 110 S540 126 610 105 S700 112 760 90','M0 112 C80 90 100 134 150 121 S245 80 305 94 S390 142 455 110 S540 126 610 105 S700 112 760 90 V220H0Z']
};
document.querySelectorAll('[data-metric]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-metric]').forEach(b=>b.classList.toggle('active',b===button));const paths=metricPaths[button.dataset.metric];document.querySelector('#linePath').setAttribute('d',paths[0]);document.querySelector('#areaPath').setAttribute('d',paths[1])}));

document.querySelectorAll('[data-resolve]').forEach(button=>button.addEventListener('click',()=>{const row=button.closest('article');button.textContent='Resuelta';button.disabled=true;row.style.opacity='.46';showToast('Incidencia marcada como resuelta')}));
document.querySelectorAll('[data-demo-action]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.demoAction)));
document.querySelector('[data-approve]').addEventListener('click',event=>{event.currentTarget.closest('.approval-panel').innerHTML='<div class="approved-state">'+icon('i-check')+'<h2>Propuesta aprobada</h2><p>Quedó registrada como decisión demo. La pauta real no fue modificada.</p></div>';showToast('Decisión registrada en la bitácora demo')});
document.querySelector('[data-reject]').addEventListener('click',event=>{event.currentTarget.closest('.approval-panel').style.opacity='.45';showToast('Propuesta descartada')});

const drawer=document.querySelector('#rokoDrawer'),drawerBackdrop=document.querySelector('#drawerBackdrop');
function toggleRoko(open){drawer.classList.toggle('open',open);drawerBackdrop.classList.toggle('open',open);drawer.setAttribute('aria-hidden',String(!open));if(open)setTimeout(()=>document.querySelector('#rokoInput').focus(),250)}
document.querySelector('#openRoko').addEventListener('click',()=>toggleRoko(true));
document.querySelector('#closeRoko').addEventListener('click',()=>toggleRoko(false));
drawerBackdrop.addEventListener('click',()=>toggleRoko(false));
function rokoResponse(question){const q=question.toLowerCase();if(q.includes('primero')||q.includes('prioridad'))return 'Primero confirma la compra de salmón: es la única señal que puede afectar venta y experiencia hoy. Después revisaría la extensión de “Comida Godín”.';if(q.includes('margen')||q.includes('perdiendo'))return 'La señal más fuerte está en materia prima: subió 1.3 puntos y salmón concentra $684 de merma semanal. Conviene revisar porción teórica contra salida real.';if(q.includes('resume')||q.includes('socios'))return 'Hoy la venta va 12.4% arriba, con 126 pedidos y ticket de $305. Hay riesgo de salmón, una campaña rentable para extender y 27 clientes frecuentes por recuperar.';return `En ${document.querySelector('#rokoContext').textContent}, la señal principal es la excepción marcada en coral. Puedo explicarte la evidencia o preparar una decisión para aprobación.`}
function sendQuestion(value){const question=value.trim();if(!question)return;const chat=document.querySelector('#rokoChat');chat.insertAdjacentHTML('beforeend',`<div class="message user"><p>${question.replace(/[<>]/g,'')}</p><time>Ahora</time></div>`);setTimeout(()=>{chat.insertAdjacentHTML('beforeend',`<div class="message roko"><p>${rokoResponse(question)}</p><time>Ahora · respuesta demo</time></div>`);chat.scrollTop=chat.scrollHeight},320);chat.scrollTop=chat.scrollHeight}
document.querySelector('#rokoForm').addEventListener('submit',event=>{event.preventDefault();const input=document.querySelector('#rokoInput');sendQuestion(input.value);input.value=''});
document.querySelectorAll('.suggestions button').forEach(button=>button.addEventListener('click',()=>sendQuestion(button.textContent)));

const modal=document.querySelector('#modalBackdrop');
function toggleModal(open){modal.hidden=!open;if(open)setTimeout(()=>document.querySelector('#closeIntegration').focus(),0)}
document.querySelector('#openIntegration').addEventListener('click',()=>toggleModal(true));
document.querySelector('#closeIntegration').addEventListener('click',()=>toggleModal(false));
modal.addEventListener('click',event=>{if(event.target===modal)toggleModal(false)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){toggleRoko(false);toggleModal(false);toggleCustomer(false);toggleAuth(false)}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.querySelector('#globalSearch').focus()}});
document.querySelector('#globalSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){const value=event.currentTarget.value.toLowerCase();if(value.includes('cliente'))setRoute('clientes');else if(value.includes('insumo')||value.includes('salm'))setRoute('insumos');else if(value.includes('campaña')||value.includes('pauta'))setRoute('campanas');else if(value.includes('reporte')||value.includes('venta'))setRoute('reporteria');else if(value.includes('pedido')||value.includes('operación'))setRoute('operacion');else showToast('Prueba: cliente, salmón, pedido, reporte o campaña')}});

const customerDrawer=document.querySelector('#customerDrawer');
const customerBackdrop=document.querySelector('#customerBackdrop');
const authBackdrop=document.querySelector('#authBackdrop');
const sourceButton=document.querySelector('#dataSourceButton');

function toggleCustomer(open){customerDrawer.classList.toggle('open',open);customerBackdrop.classList.toggle('open',open);customerDrawer.setAttribute('aria-hidden',String(!open))}
function toggleAuth(open){authBackdrop.hidden=!open;if(open)setTimeout(()=>document.querySelector('#authEmail').focus(),0)}
function setDataStatus(mode,label){state.dataMode=mode;sourceButton.textContent=label;sourceButton.classList.toggle('live',mode==='live');sourceButton.classList.toggle('blocked',mode==='blocked')}
function segmentFor(row){const visits=Number(row.visit_count)||0;const spend=Number(row.total_spend)||0;const days=row.last_visit_at?Math.floor((Date.now()-new Date(row.last_visit_at).getTime())/86400000):999;if(visits===1)return ['new','Primera visita'];if(visits>=2&&days>=45)return ['risk','En riesgo'];if(visits>=4||spend>=1000)return ['vip','Alto valor'];return ['all','Activo']}
function updateCustomerKpis(){
  const count=customerRecords.length;
  const frequent=customerRecords.filter(c=>Number(c.visits)>=3).length;
  const risk=customerRecords.filter(c=>c.status==='risk').length;
  const vip=customerRecords.filter(c=>c.status==='vip').length;
  const fresh=customerRecords.filter(c=>c.status==='new').length;
  const ticketValue=c=>Number(c.averageTicket)||Number(String(c.ticket||'').replace(/[^0-9.-]/g,''))||0;
  const ticketRows=customerRecords.filter(c=>ticketValue(c)>0);
  const avg=ticketRows.length?ticketRows.reduce((sum,c)=>sum+ticketValue(c),0)/ticketRows.length:0;
  document.querySelector('#customersTotal').textContent=count.toLocaleString('es-MX');
  document.querySelector('#customersTotalNote').textContent=state.dataMode==='live'?'Supabase · alcance autorizado':'Fixtures del adaptador';
  document.querySelector('#customersFrequent').textContent=frequent.toLocaleString('es-MX');
  document.querySelector('#customersFrequentNote').textContent=count?`${Math.round(frequent/count*100)}% de la base`:'Sin historial todavía';
  document.querySelector('#customersRisk').textContent=risk.toLocaleString('es-MX');
  document.querySelector('#customersRiskNote').textContent='45+ días sin visita';
  document.querySelector('#customersAverageTicket').textContent=money(avg);
  document.querySelector('#customersTicketNote').textContent=ticketRows.length?'visitas conciliadas con venta':'pendiente de vincular tickets';
  document.querySelector('#segmentAllCount').textContent=count.toLocaleString('es-MX');
  document.querySelector('#segmentRiskCount').textContent=risk.toLocaleString('es-MX');
  document.querySelector('#segmentVipCount').textContent=vip.toLocaleString('es-MX');
  document.querySelector('#segmentNewCount').textContent=fresh.toLocaleString('es-MX');
  document.querySelector('#segmentOpportunity').textContent=money(customerRecords.filter(c=>c.status==='risk').reduce((sum,c)=>sum+ticketValue(c),0));
  document.querySelector('#segmentOpportunityNote').textContent='Una visita estimada por cada cliente en riesgo, usando su ticket histórico.';
}

async function safeQuery(promise){const {data,error}=await promise;if(error)return {data:[],error};return {data:data||[],error:null}}

async function loadProtectedContact(clientId){
  const config=window.ARROKO_CRM_CONFIG;
  const token=crmClient?.auth.getAccessToken();
  if(!config?.supabaseUrl||!config?.supabaseAnonKey||!token)return {data:null,error:'authentication_required'};
  try{
    const response=await fetch(`${config.supabaseUrl}/functions/v1/arroko-crm-contact-vault`,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':config.supabaseAnonKey,'Authorization':`Bearer ${token}`},
      body:JSON.stringify({action:'contact.detail',client_id:clientId,purpose:'customer_360'})
    });
    const payload=await response.json().catch(()=>({ok:false,error:'invalid_response'}));
    return response.ok&&payload.ok?{data:payload.contact,error:null}:{data:null,error:payload.error||'contact_unavailable'};
  }catch(_error){return {data:null,error:'network_error'}}
}

function contactSection(result){
  if(result.error==='insufficient_role')return '<section class="detail-section"><div class="detail-heading"><h3>Contacto protegido</h3><span>Acceso restringido</span></div><p class="detail-note">Tu rol no permite revelar datos personales. El acceso está limitado a propietarios y administradores.</p></section>';
  if(result.error==='contact_not_found')return '<section class="detail-section"><div class="detail-heading"><h3>Contacto protegido</h3><span>Sin datos cifrados</span></div><p class="detail-note">Este cliente fue registrado antes de activar la bóveda. Se completará en su siguiente check-in.</p></section>';
  if(result.error||!result.data)return '<section class="detail-section"><div class="detail-heading"><h3>Contacto protegido</h3><span>No disponible</span></div><p class="detail-note">No se pudo abrir la bóveda en este momento.</p></section>';
  const contact=result.data;
  const birthday=contact.birth_date?new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${contact.birth_date}T00:00:00Z`)):'No registrado';
  return `<section class="detail-section"><div class="detail-heading"><h3>Contacto protegido</h3><span>Acceso auditado</span></div><div class="detail-row"><div><strong>${escapeHtml(contact.phone||'No registrado')}</strong><small>Teléfono / WhatsApp</small></div><span>Revelado por rol</span></div><div class="detail-row"><div><strong>${contact.instagram?`@${escapeHtml(contact.instagram)}`:'No registrado'}</strong><small>Instagram</small></div><span>${escapeHtml(birthday)}</span></div><p class="detail-note">Cada consulta queda registrada para trazabilidad y protección del cliente.</p></section>`;
}

async function loadLiveCustomers(){
  if(!crmClient)return false;
  setDataStatus('fixtures','Consultando Supabase…');
  const {data,error}=await crmClient.from('arroko_customer_360').select('*').order('last_visit_at',{ascending:false,nullsFirst:false}).limit(500);
  if(error){setDataStatus('blocked','Acceso requerido');showToast('Inicia sesión con una cuenta autorizada de Arroko');return false}
  customerRecords=(data||[]).map(row=>{const [status,label]=segmentFor(row);return {id:row.client_id,name:row.display_name||'Cliente sin nombre',phone:row.phone_last4?`••• ${row.phone_last4}`:'Contacto protegido',last:relativeDate(row.last_visit_at),visits:Number(row.visit_count)||0,ticket:money(row.average_ticket),averageTicket:Number(row.average_ticket)||0,status,label,_raw:row}});
  setDataStatus('live','Supabase · En vivo');updateCustomerKpis();renderCustomers();return true;
}

async function openCustomerDetail(clientId){
  if(state.dataMode!=='live'||!clientId){showToast('El detalle 360 requiere una sesión autorizada');toggleAuth(true);return}
  const client=customerRecords.find(item=>item.id===clientId);if(!client)return;
  toggleCustomer(true);document.querySelector('#customerDetailTitle').textContent=client.name;document.querySelector('#customerDetail').innerHTML='<div class="detail-loading">Cruzando visitas, tickets, Arrokids y memoria…</div>';
  const orgId=client._raw.org_id;
  const contactPromise=loadProtectedContact(clientId);
  const householdResult=await safeQuery(crmClient.from('arroko_households').select('*').eq('org_id',orgId).eq('primary_client_id',clientId).limit(1));
  const household=householdResult.data[0]||null;
  const visitsResult=await safeQuery(crmClient.from('arroko_visits').select('*').eq('org_id',orgId).eq('client_id',clientId).order('checked_in_at',{ascending:false}).limit(50));
  const visits=visitsResult.data;
  const visitIds=visits.map(v=>v.id);
  const visitLinksResult=visitIds.length?await safeQuery(crmClient.from('arroko_visit_orders').select('*').eq('org_id',orgId).in('visit_id',visitIds)): {data:[]};
  const orderIds=visitLinksResult.data.map(link=>link.order_id);
  const ordersResult=orderIds.length?await safeQuery(crmClient.from('arroko_orders').select('id,external_id,total,status,opened_at,closed_at,channel').eq('org_id',orgId).in('id',orderIds)): {data:[]};
  const [childrenResult,gamesResult,rewardsResult,consentsResult,clientNodesResult,contactResult]=await Promise.all([
    household?safeQuery(crmClient.from('arroko_child_profiles').select('*').eq('org_id',orgId).eq('household_id',household.id).eq('active',true)):Promise.resolve({data:[]}),
    visitIds.length?safeQuery(crmClient.from('arroko_game_sessions').select('*').eq('org_id',orgId).in('visit_id',visitIds).order('completed_at',{ascending:false}).limit(50)):Promise.resolve({data:[]}),
    household?safeQuery(crmClient.from('arroko_reward_ledger').select('*').eq('org_id',orgId).eq('household_id',household.id).order('created_at',{ascending:false}).limit(50)):Promise.resolve({data:[]}),
    safeQuery(crmClient.from('arroko_consent_events').select('*').eq('org_id',orgId).eq('client_id',clientId).order('recorded_at',{ascending:false}).limit(30)),
    safeQuery(crmClient.from('arroko_knowledge_nodes').select('*').eq('org_id',orgId).or(`entity_id.eq.${clientId}${household?`,entity_id.eq.${household.id}`:''}`).limit(50)),
    contactPromise
  ]);
  const gameDefinitionIds=[...new Set(gamesResult.data.map(g=>g.game_definition_id))];
  const gameDefs=gameDefinitionIds.length?(await safeQuery(crmClient.from('arroko_game_definitions').select('id,name,game_key').in('id',gameDefinitionIds))).data:[];
  const nodeIds=clientNodesResult.data.map(node=>node.id);
  const edges=nodeIds.length?(await safeQuery(crmClient.from('arroko_knowledge_edges').select('*').eq('org_id',orgId).in('subject_node_id',nodeIds).is('superseded_at',null).order('observed_at',{ascending:false}).limit(40))).data:[];
  const gameNames=new Map(gameDefs.map(game=>[game.id,game.name]));
  const children=new Map(childrenResult.data.map(child=>[child.id,child]));
  const orders=new Map(ordersResult.data.map(order=>[order.id,order]));
  const orderByVisit=new Map(visitLinksResult.data.map(link=>[link.visit_id,{...orders.get(link.order_id),match_method:link.match_method,confidence:link.confidence}]));
  const points=rewardsResult.data.reduce((sum,row)=>sum+Number(row.points_delta||0),0);
  const latestConsent=new Map();consentsResult.data.forEach(row=>{if(!latestConsent.has(row.scope))latestConsent.set(row.scope,row)});
  const scopeLabels={service:'Servicio',loyalty:'Lealtad',marketing_whatsapp:'WhatsApp',marketing_email:'Email',personalization:'Personalización',child_participation:'Participación infantil'};
  document.querySelector('#customerDetail').innerHTML=`
    <section class="detail-hero"><div><span>${escapeHtml(client.phone)}</span><strong>${escapeHtml(client.last)}</strong></div><span class="status-chip ${escapeHtml(client.status)}">${escapeHtml(client.label)}</span></section>
    <section class="detail-metrics"><article><span>Visitas</span><strong>${client.visits}</strong></article><article><span>Ticket promedio</span><strong>${escapeHtml(client.ticket)}</strong></article><article><span>Consumo total</span><strong>${money(client._raw.total_spend)}</strong></article><article><span>Puntos familia</span><strong>${points}</strong></article></section>
    ${contactSection(contactResult)}
    <section class="detail-section"><div class="detail-heading"><h3>ArroKids</h3><span>${children.size} perfiles · ${gamesResult.data.length} partidas</span></div>${children.size?[...children.values()].map(child=>`<div class="detail-row"><div><strong>${escapeHtml(child.alias)}</strong><small>Rango ${escapeHtml(child.age_band||'no indicado')}</small></div><span>Perfil seudónimo</span></div>`).join(''):'<p class="detail-note">Sin perfiles infantiles asociados.</p>'}${gamesResult.data.slice(0,5).map(game=>`<div class="timeline-row"><i></i><div><strong>${escapeHtml(gameNames.get(game.game_definition_id)||'Juego Arrokids')}</strong><small>${escapeHtml(children.get(game.child_profile_id)?.alias||'Jugador')} · ${game.score} score · ${game.points_awarded} puntos</small></div><time>${relativeDate(game.completed_at)}</time></div>`).join('')}</section>
    <section class="detail-section"><div class="detail-heading"><h3>Visitas y consumo</h3><span>${visits.length} registradas</span></div>${visits.slice(0,8).map(visit=>{const order=orderByVisit.get(visit.id);return `<div class="timeline-row"><i class="visit"></i><div><strong>${new Date(visit.checked_in_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})} · ${order?money(order.total):'Ticket pendiente'}</strong><small>${escapeHtml(visit.source.toUpperCase())} · ${visit.party_size||'—'} personas · ${escapeHtml(visit.status)}${order?` · ${escapeHtml(order.match_method)} ${Math.round(Number(order.confidence)*100)}%`:''}</small></div><time>${new Date(visit.checked_in_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</time></div>`}).join('')||'<p class="detail-note">Sin visitas registradas.</p>'}</section>
    <section class="detail-section"><div class="detail-heading"><h3>Consentimientos</h3><span>${consentsResult.error?'Sólo administradores':'Último estado'}</span></div>${consentsResult.error?'<p class="detail-note">Tu rol no permite ver evidencia de consentimiento.</p>':[...latestConsent.values()].map(row=>`<div class="consent-row"><span>${escapeHtml(scopeLabels[row.scope]||row.scope)}</span><b class="${row.granted?'granted':'denied'}">${row.granted?'Otorgado':'No otorgado'}</b><small>${new Date(row.recorded_at).toLocaleDateString('es-MX')}</small></div>`).join('')||'<p class="detail-note">Sin eventos de consentimiento.</p>'}</section>
    <section class="detail-section"><div class="detail-heading"><h3>Memoria verificable</h3><span>${edges.length} relaciones</span></div>${edges.map(edge=>`<div class="memory-row"><div><strong>${escapeHtml(edge.predicate.replaceAll('_',' '))}</strong><small>${escapeHtml(edge.provenance_type)} · confianza ${Math.round(Number(edge.confidence)*100)}%</small></div><span class="memory-kind ${escapeHtml(edge.assertion_kind)}">${edge.assertion_kind==='fact'?'Hecho':'Inferencia'}</span></div>`).join('')||'<p class="detail-note">La memoria crecerá con visitas, tickets, juegos y promociones.</p>'}</section>`;
}

document.querySelector('#customerRows').addEventListener('click',event=>{const row=event.target.closest('tr[data-client-id]');if(row)openCustomerDetail(row.dataset.clientId)});
document.querySelector('#customerRows').addEventListener('keydown',event=>{if(event.key==='Enter'){const row=event.target.closest('tr[data-client-id]');if(row)openCustomerDetail(row.dataset.clientId)}});
document.querySelector('#closeCustomer').addEventListener('click',()=>toggleCustomer(false));customerBackdrop.addEventListener('click',()=>toggleCustomer(false));
sourceButton.addEventListener('click',()=>toggleAuth(true));document.querySelector('#closeAuth').addEventListener('click',()=>toggleAuth(false));authBackdrop.addEventListener('click',event=>{if(event.target===authBackdrop)toggleAuth(false)});
document.querySelector('#authForm').addEventListener('submit',async event=>{event.preventDefault();const errorNode=document.querySelector('#authError');errorNode.textContent='';if(!crmClient){errorNode.textContent='La configuración local de Supabase no está disponible.';return}const email=document.querySelector('#authEmail').value.trim();const password=document.querySelector('#authPassword').value;const {error}=await crmClient.auth.signInWithPassword({email,password});if(error){errorNode.textContent='No se pudo iniciar sesión. Revisa la cuenta y sus permisos.';return}document.querySelector('#authLogout').hidden=false;const loaded=await loadLiveCustomers();if(loaded){toggleAuth(false);showToast('CRM conectado a Supabase')}});
document.querySelector('#authLogout').addEventListener('click',async()=>{if(crmClient)await crmClient.auth.signOut();customerRecords=[...customers];setDataStatus('fixtures','Demo · Fixtures');updateCustomerKpis();renderCustomers();toggleAuth(false)});

async function initializeCrm(){
  const config=window.ARROKO_CRM_CONFIG;
  if(!config?.supabaseUrl||!config?.supabaseAnonKey){setDataStatus('fixtures','Demo · Fixtures');updateCustomerKpis();return}
  crmClient=createCrmClient(config);
  const {data:{session}}=await crmClient.auth.getSession();
  document.querySelector('#authLogout').hidden=!session;
  if(session)await loadLiveCustomers();else{setDataStatus('blocked','Acceso requerido');updateCustomerKpis()}
}

renderCustomers();renderInventory();setRoute(state.route);initializeCrm();
