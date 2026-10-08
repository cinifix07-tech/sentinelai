import { Visitor, SecurityEvent, DialogueMessage, NodeTelemetry } from './types';

export const INITIAL_VISITORS: Visitor[] = [
  {
    id: 'vis-1',
    name: 'John Doe',
    affiliation: 'FedEx Delivery',
    role: 'Courier Delivery',
    schedule: 'Today • 08:00 – 17:00',
    scheduleType: 'today',
    status: 'authorized',
    ruleType: 'conversational',
    ruleDescription: 'Conversational prompt: Carrier name & Tracking ID check. Match threshold 92%.',
    lastVisit: 'Today at 14:35',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOSLwM8cG1L7iL_iOf-zz1_GqVQScKjeXPahBK9GSxWGmkEFkCHdXy6pWVq5zNg09oaGmhVrFoaMS3TJmiIoEYtqFrR-HxbEjeCpWntdr_0C2Ol251m8Pq7OA-IWLxAf1tCKvodZFlfqCEceDIZlUhdDjZegNgse1zINIf1qBbFjpw70Nx2hbgeACkK-2NImmp5STjf05M1xmDw7Q5XrgY7VesaPkqcvAUki1xXSmJDIQvBZeYZg_B',
  },
  {
    id: 'vis-2',
    name: 'Elena Rostova',
    affiliation: 'House Cleaning',
    role: 'Domestic Service',
    schedule: 'Tue & Thu • 09:00 – 13:00',
    scheduleType: 'recurring',
    status: 'authorized',
    ruleType: 'biometric',
    ruleDescription: 'Voice confirmation & safe phrase verification: "Blue Horizon Garden".',
    lastVisit: 'Yesterday 09:15',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpQnWNhY1XrIUO9KkWXgGDrgp4jGkp1KhMsNeKwyLGWZyYeqO5LU9a0L1RqCk20BADSGOaaNduG0jWdCc6lJ0arrN9s48kc9c1SmNGK4rGl9GrR9cap2jA1V0AF3W5LOig__FhlHWDtIZRuFd039W2Zt7x2i24OIuARXnMZBoXANQVkiQ_R7ygH6ExQEha0WMhwYedI0XnNKAkHZV0bJn_W2VxX4qkwAcUN9z8JkAn0xJzUC0WlPkl',
  },
  {
    id: 'vis-3',
    name: 'David Kim',
    affiliation: 'Gardener',
    role: 'Landscape Care',
    schedule: 'Fridays • 10:00 – 12:00',
    scheduleType: 'recurring',
    status: 'pending',
    ruleType: 'conversational',
    ruleDescription: 'Weekly recurrent pass concluded on Friday. AI conversation agent paused.',
    lastVisit: '7 days ago',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWWnYv1b4bZbr1xKff6WYL6sqE8dlFQxLmmOihSrQ-DOIPYgRnDKQqKQ3EqvBqK1piAH_o4SrgVxBmEuMBHARh5wQpAtFOl_68JLNgKuHIdEePZ80VothoIPW5W8USzU1bgrxNx_2ggVJXm0HzCutw4OSNXXZhz-_2rtnJTEsS0dStnfyR5KshZ1kIODJdZEUh1E9trJIBqg99LOfsYejrAOrb23MbvGsziRW0khxh2UOe0BX_zOrl',
  },
  {
    id: 'vis-4',
    name: 'Marcus Bell (USPS)',
    affiliation: 'USPS Postal Carrier',
    role: 'Mail Carrier',
    schedule: 'Daily • 11:00 – 14:00',
    scheduleType: 'today',
    status: 'authorized',
    ruleType: 'conversational',
    ruleDescription: 'Carrier badge OCR match + official postal greeting validation.',
    lastVisit: 'Today at 11:20',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-yDK5IfuEQ9CgyzBZQWHOOS56W3WlThF3FV1OnjZkjpM0RmygSQpYtbY-KocCO6QjomiXB2YBb5bDk1l0LhHuU917oBDJu3K4bDPJ8JUT-y-cCRSqVItxKEIVsKXuOXfexz9dbKJN1c8Yg1qbEqnOPUu7fUonlWBeK5G7AgcMFLPYlJmFlFNw9DmWLgOVlBW92cO3pmmo0QEXWemQGzPZ80veSOm7rwgXcxeHkOSaQ4b3mjyKjzm0',
  }
];

export const INITIAL_ONE_TIME_PASSES: Visitor[] = [
  {
    id: 'otp-1',
    name: 'Amazon Prime Logistics',
    affiliation: 'Package Courier',
    role: 'One-Time Delivery',
    schedule: 'Today • 15:30 – 17:30',
    scheduleType: 'onetime',
    status: 'authorized',
    ruleType: 'passcode',
    passcode: '#8429',
    ruleDescription: 'Automated locker dropoff code #8429. Single entry window.',
    lastVisit: 'Pending arrival',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOSLwM8cG1L7iL_iOf-zz1_GqVQScKjeXPahBK9GSxWGmkEFkCHdXy6pWVq5zNg09oaGmhVrFoaMS3TJmiIoEYtqFrR-HxbEjeCpWntdr_0C2Ol251m8Pq7OA-IWLxAf1tCKvodZFlfqCEceDIZlUhdDjZegNgse1zINIf1qBbFjpw70Nx2hbgeACkK-2NImmp5STjf05M1xmDw7Q5XrgY7VesaPkqcvAUki1xXSmJDIQvBZeYZg_B',
  },
  {
    id: 'otp-2',
    name: 'AquaTech HVAC Inspection',
    affiliation: 'AquaTech Heating & Cooling',
    role: 'Contractor',
    schedule: 'Tomorrow • 10:00 – 12:00',
    scheduleType: 'onetime',
    status: 'authorized',
    ruleType: 'conversational',
    passcode: 'WORK-904',
    ruleDescription: 'Verify company work ticket WORK-904 and technician dispatch badge.',
    lastVisit: 'Never',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWWnYv1b4bZbr1xKff6WYL6sqE8dlFQxLmmOihSrQ-DOIPYgRnDKQqKQ3EqvBqK1piAH_o4SrgVxBmEuMBHARh5wQpAtFOl_68JLNgKuHIdEePZ80VothoIPW5W8USzU1bgrxNx_2ggVJXm0HzCutw4OSNXXZhz-_2rtnJTEsS0dStnfyR5KshZ1kIODJdZEUh1E9trJIBqg99LOfsYejrAOrb23MbvGsziRW0khxh2UOe0BX_zOrl',
  }
];

export const INITIAL_EVENTS: SecurityEvent[] = [
  {
    id: 'evt-1',
    title: 'Access Authorized',
    time: '14:35',
    description: 'Automated verification completed • Porch opened',
    type: 'access',
    icon: 'check_circle',
    color: 'primary',
  },
  {
    id: 'evt-2',
    title: 'Visitor Intent Stated',
    time: '14:34',
    description: 'Voice matched "Package delivery for unit"',
    type: 'visitor',
    icon: 'record_voice_over',
    color: 'secondary',
  },
  {
    id: 'evt-3',
    title: 'AI Intercom Triggered',
    time: '14:33',
    description: 'Conversational agent greeted unknown visitor',
    type: 'ai',
    icon: 'smart_toy',
    color: 'tertiary',
  },
  {
    id: 'evt-4',
    title: 'PIR Motion Detected',
    time: '14:32',
    description: 'HC-SR501 Entrance Sensor triggered',
    type: 'pir',
    icon: 'sensors',
    color: 'tertiary',
  },
  {
    id: 'evt-5',
    title: 'Perimeter Boundary Check',
    time: '13:58',
    description: 'HC-SR501 calibration sweep complete • 0 disturbances',
    type: 'pir',
    icon: 'radar',
    color: 'primary',
  }
];

export const INITIAL_DIALOGUE: DialogueMessage[] = [
  {
    id: 'dlg-1',
    sender: 'ai',
    time: '14:33',
    text: 'Hello. Before entering, may I ask you a few quick questions?',
  },
  {
    id: 'dlg-2',
    sender: 'visitor',
    time: '14:33',
    text: 'My name is John.',
  },
  {
    id: 'dlg-3',
    sender: 'ai',
    time: '14:34',
    text: 'What is the purpose of your visit today, John?',
  },
  {
    id: 'dlg-4',
    sender: 'visitor',
    time: '14:34',
    text: 'I am here to deliver a package from FedEx for Sarah.',
  },
  {
    id: 'dlg-5',
    sender: 'ai',
    time: '14:34',
    text: 'Thank you. Checking visitor schedule for FedEx parcel delivery...',
  }
];

export const INITIAL_TELEMETRY: NodeTelemetry = {
  cpuLoad: 34,
  freeRamKb: 142,
  wifiRssi: -61,
  firmwareVersion: 'v1.0.0 Stable',
  online: true,
  ipAddress: '192.168.1.184',
  mqttConnected: true,
  pirActive: true,
  activeSeconds: 18,
  distanceMeters: 3.2,
  confidencePercent: 94,
  azimuthDeg: 18.4,
};

export const BRAND_ASSETS = {
  emblem: '/assets/stitch/emblem.svg',
  profile: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrlv8fD8ofaNVV111Eo5830gPipJ_gU3nKFbQ6XrVVqHNiG7ZG2gpryiN0_ZnmpiClg2Sy3Yi_SEKjdtqGaIvCEKboBK3H-QP9lLwRF_NKQmGqTI3am-hFG6ciMGLCdrBkgCrIoJcT1i9URhvYF1B_RluDikQqyieCOVyYTrKZ4T58HN6qSq3tgSrawdyu37PPlNkh-jR9NM7nfO28gIZorAxYbbszSW4wAvOWZPwP6KC6MensGHx-',
  doorbellCam: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHm84ppoWaHA0c2nUWoBl69i8CH4ZB1yyj3QcNH-qUDNGt8uhxcNAXPifXgdRs_eehsyVgKVppcXErMLQVxvV0DRFPRmU7hxpJwHlIcZ4I_-x9bisZMXBtyH4FgikeGpqIH4A4M0Da07oG_3RnhtUxHQZXqdE2Xdyz4unxI2szmy7IYP8zz4i3A18cFOjNrCofknPJKweg_TPw9QKq9p-9KnTDFlVt0Q8TS9H4WHBdoZc2bS75pqY-',
  courierPortrait: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-yDK5IfuEQ9CgyzBZQWHOOS56W3WlThF3FV1OnjZkjpM0RmygSQpYtbY-KocCO6QjomiXB2YBb5bDk1l0LhHuU917oBDJu3K4bDPJ8JUT-y-cCRSqVItxKEIVsKXuOXfexz9dbKJN1c8Yg1qbEqnOPUu7fUonlWBeK5G7AgcMFLPYlJmFlFNw9DmWLgOVlBW92cO3pmmo0QEXWemQGzPZ80veSOm7rwgXcxeHkOSaQ4b3mjyKjzm0',
};
