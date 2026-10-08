export const initialVisitors = [
 { id:'john', name:'John Doe', company:'FedEx Delivery', schedule:'Today, 08:00 - 17:00', rule:'Carrier name & tracking ID check', detail:'Match threshold 92% · Resident Sarah Chen', status:'authorized', once:false, initials:'JD', lastVisit:'Today at 14:35' },
 { id:'elena', name:'Elena Rostova', company:'Housekeeping', schedule:'Tue & Thu, 09:00 - 13:00', rule:'Safe phrase verification', detail:'Blue Horizon Garden', status:'authorized', once:false, initials:'ER', lastVisit:'Yesterday at 09:15' },
 { id:'david', name:'David Kim', company:'Gardener', schedule:'Fridays, 10:00 - 12:00', rule:'Recurring visitor schedule', detail:'Weekly pass expired. Renew to restore access.', status:'expired', once:false, initials:'DK', lastVisit:'7 days ago' },
]
export const initialEvents = [
 {id:'e1', title:'Access authorized', detail:'Delivery rule matched · Porch access granted', time:'14:35', icon:'check', tone:'success'},
 {id:'e2', title:'Visitor intent stated', detail:'Package delivery for Sarah Chen', time:'14:34', icon:'box', tone:'info'},
 {id:'e3', title:'AI intercom triggered', detail:'Conversational assistant greeted the visitor', time:'14:33', icon:'mic'},
 {id:'e4', title:'PIR motion detected', detail:'HC-SR501 · Front entrance zone', time:'14:32', icon:'radar'},
]
export const initialState = {
 mode:'away', session:'idle', motion:false, motionSince:null, packet:null,
 muted:false, mic:false, takeover:false, locked:true, simulation:false,
 sensitivity:'Medium (4.2m)', rules:{autoGrant:true, unknownApproval:true},
 visitors:initialVisitors, events:initialEvents, unread:4,
}
function event(state, action, title, detail, icon='check', tone='success') {
 return {...state, unread:state.unread+1, events:[{id:action.id, time:action.time, title, detail, icon, tone}, ...state.events].slice(0,30)}
}
export function sentinelReducer(state, action) {
 switch(action.type) {
  case 'MODE': return event({...state, mode:action.value, motion:false, session:'idle', mic:false, takeover:false}, action, `System ${action.value === 'disarmed' ? 'disarmed' : 'armed '+action.value}`, 'Security mode updated in this demo', action.value === 'disarmed' ? 'unlock' : 'shield')
  case 'MOTION': {
   if(state.mode==='disarmed' || state.session!=='idle') return state
   return event({...state, motion:true, motionSince:action.now, packet:{node:'esp32-porch-01', sensor:'HC-SR501', gpio:14, level:1, motion:true, qos:1, timestamp:new Date(action.now).toISOString()}, session:'listening', mic:true, takeover:false}, action, 'PIR motion detected', 'ESP32 published motion packet · Voice intercom started', 'radar','info')
  }
  case 'LIVE_READING': {
   const reading = action.reading || {}
   const device = action.device || {}
   const detected = Boolean(reading.motion_detected)
   const packet = reading.created_at ? {
    node: device.device_code || 'esp32-porch-01',
    sensor: device.device_type || 'HC-SR501',
    gpio: 27,
    level: detected ? 1 : 0,
    motion: detected,
    qos: 1,
    timestamp: reading.created_at,
   } : state.packet
   const next = {...state, motion:detected, motionSince:detected ? Date.now() : null, packet, session:detected ? 'listening':'idle', mic:detected}
   if (!detected) return next
   return event(next, action, 'PIR motion detected', `${device.device_name || 'ESP32'} published live motion packet`, 'radar', 'info')
  }
  case 'LIVE_ACTIVITY': {
   const saved = Array.isArray(action.events) ? action.events : []
   const existingIds = new Set(saved.map(item => item.id))
   return {...state, events:[...saved, ...state.events.filter(item => !existingIds.has(item.id))].slice(0,30)}
  }
  case 'SESSION': return {...state, session:action.value}
  case 'EVALUATE': {
   const matched=state.visitors.some(v=>v.id==='john' && v.status==='authorized')
   return event({...state, session:matched?'authorized':'rejected', mic:false, locked:matched && state.rules.autoGrant ? false : state.locked},action,matched?'Visitor verified':'Visitor requires review',matched?(state.rules.autoGrant?'FedEx schedule matched · Demo porch unlocked':'FedEx schedule matched · Manual unlock required'):(state.rules.unknownApproval?'No active rule matched · Homeowner approval requested':'No active rule matched · Access denied'),matched?'check':'bell',matched?'success':'danger')
  }
  case 'STOP': return {...state, session:'idle', motion:false, mic:false, takeover:false}
  case 'TAKEOVER': return {...state, takeover:true, session:'listening', mic:true}
  case 'MIC': return {...state, mic:!state.mic}
  case 'LOCKDOWN': return event({...state, locked:true, mode:'away', motion:false, session:'idle', mic:false, takeover:false},action,'Porch lockdown activated','Demo porch locked · Armed Away enabled','lock')
  case 'UNLOCK': return event({...state, locked:false}, action,'Porch unlocked manually','Homeowner override · Demo action','unlock','info')
  case 'MUTE': return {...state, muted:action.value}
  case 'SIMULATION': return {...state, simulation:action.value}
  case 'SENSITIVITY': return {...state, sensitivity:action.value}
  case 'RULE': return {...state, rules:{...state.rules,[action.key]:!state.rules[action.key]}}
  case 'SAVE_VISITOR': return {...state, visitors:state.visitors.some(v=>v.id===action.visitor.id)?state.visitors.map(v=>v.id===action.visitor.id?action.visitor:v):[action.visitor,...state.visitors]}
  case 'REVOKE': return {...state,visitors:state.visitors.map(v=>v.id===action.visitorId?{...v,status:'revoked'}:v)}
  case 'RENEW': return {...state,visitors:state.visitors.map(v=>v.id===action.visitorId?{...v,status:'authorized'}:v)}
  case 'READ': return {...state,unread:0}
  default: return state
 }
}
export const sessionLabels = {idle:'Ready to assist', listening:'Listening', processing:'Processing intent', verifying:'Verifying visit', authorized:'Visitor authorized', rejected:'Review required'}
