export type AppTab = 'home' | 'monitor' | 'voice' | 'visitors' | 'settings';

export type SecurityMode = 'away' | 'home' | 'disarm';

export type AppTheme = 'daylight' | 'twilight' | 'midnight' | 'sage';

export type VisitorStatus = 'authorized' | 'pending' | 'expired';

export interface Visitor {
  id: string;
  name: string;
  affiliation: string;
  role: string;
  schedule: string;
  scheduleType: 'today' | 'recurring' | 'onetime';
  status: VisitorStatus;
  ruleType: 'conversational' | 'biometric' | 'passcode';
  ruleDescription: string;
  lastVisit: string;
  photoUrl: string;
  passcode?: string;
}

export interface SecurityEvent {
  id: string;
  title: string;
  time: string;
  description: string;
  type: 'access' | 'visitor' | 'ai' | 'pir' | 'lockdown';
  icon: string;
  color: string;
}

export interface DialogueMessage {
  id: string;
  sender: 'ai' | 'visitor' | 'operator';
  time: string;
  text: string;
}

export interface NodeTelemetry {
  cpuLoad: number;
  freeRamKb: number;
  wifiRssi: number;
  firmwareVersion: string;
  online: boolean;
  ipAddress: string;
  mqttConnected: boolean;
  pirActive: boolean;
  activeSeconds: number;
  distanceMeters: number;
  confidencePercent: number;
  azimuthDeg: number;
}
