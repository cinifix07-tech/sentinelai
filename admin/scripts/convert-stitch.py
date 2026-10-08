"""Convert the supplied, reviewed Stitch markup to native JSX (no source scripts)."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'stitch-reference/stitch_sentinel_ai_security_dashboard'
OUT = ROOT / 'src/screens'
OUT.mkdir(parents=True, exist_ok=True)
VOID = {'img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'source', 'wbr'}

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in VOID:
            self.current = node
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)
    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent
    def handle_data(self, data):
        self.current.children.append(data)

def find(node, tag):
    if node.tag == tag:
        return node
    for child in node.children:
        if isinstance(child, Node):
            result = find(child, tag)
            if result:
                return result

def text(node):
    if isinstance(node, str):
        return node
    if 'material-symbols' in node.attrs.get('class', ''):
        return ''
    return ' '.join(text(c) for c in node.children).strip()

def camel(value):
    return re.sub(r'-([a-z])', lambda m: m[1].upper(), value)

assets = {}
def jsx(node, article=None):
    if isinstance(node, str):
        return '{' + json.dumps(node, ensure_ascii=False) + '}' if node.strip() else '\n'
    tag, attrs = node.tag, dict(node.attrs)
    ident = attrs.get('id', '')
    if tag in {'script', 'style'} or ident == 'add-visitor-sheet':
        return ''
    if tag == 'article':
        article = text(node).split(' Today')[0].split(' Tue')[0].split(' Fridays')[0].strip()
    label = ' '.join(text(node).split())
    extra = []
    custom = None
    if tag == 'button':
        attrs.setdefault('type', 'button')
        action = ident or label
        if ident.startswith('mode-'):
            mode = ident[5:]
            attrs['class'] = 'mode-button h-target-min px-2 rounded-md font-label-sm text-label-sm flex items-center justify-center gap-1'
            extra.append('aria-pressed={ui.mode === ' + json.dumps(mode) + '}')
        if attrs.get('data-tab'):
            attrs['class'] = 'tab-pill flex-1 min-w-[110px] py-2 px-3 rounded-full font-label-sm text-label-sm text-center transition-all'
            extra.append('aria-pressed={ui.tab === ' + json.dumps(attrs['data-tab']) + '}')
            action = 'tab:' + attrs['data-tab']
        if attrs.get('data-val'):
            attrs['class'] = 'sensitivity-button py-1.5 text-center font-label-sm text-label-sm rounded'
            extra.append('aria-pressed={ui.sensitivity === ' + json.dumps(attrs['data-val']) + '}')
            action = 'sensitivity:' + attrs['data-val']
        extra.append('onClick={() => act(' + json.dumps(action) + ', ' + json.dumps(article) + ')}')
        if ident == 'muteChimeBtn':
            custom = '<span className="material-symbols-outlined">{ui.muted ? "volume_off" : "notifications_paused"}</span><span>{ui.muted ? "Unmute Chime" : "Mute Chime (5m)"}</span>'
            extra.append('aria-pressed={ui.muted}')
        if ident == 'mic-action-btn':
            custom = '<span className="material-symbols-outlined text-[32px]">{ui.mic ? "mic" : "mic_off"}</span>'
            extra.append('aria-pressed={ui.mic}')
        if attrs.get('data-tab') == 'scheduled':
            custom = '{"Scheduled (" + (3 - ui.revoked.length + ui.visitors.filter(v => !v.once).length) + ")"}'
    if ident == 'pir-value-label':
        custom = '{ui.sensitivity}'
    if tag == 'input' and attrs.get('type') == 'checkbox':
        attrs.pop('checked', None)
        extra += ['checked={ui.rules[' + json.dumps(ident) + ']}', 'onChange={() => act("toggle-rule", ' + json.dumps(ident) + ')}', 'aria-label=' + json.dumps('Automatically grant verified access' if 'autogrant' in ident else 'Require approval for unknown visitors')]
    if tag == 'img':
        url = attrs.get('src', '')
        if url.startswith('https://'):
            if url not in assets:
                assets[url] = '/assets/stitch/image-' + str(len(assets) + 1) + '.png'
            attrs['src'] = assets[url]
        attrs.setdefault('alt', attrs.pop('data-alt', ''))
        attrs['loading'] = 'lazy'
    if tag == 'span' and 'material-symbols' in attrs.get('class', ''):
        attrs['aria-hidden'] = 'true'
        if label == '' and text(node.parent) == 'Test PIR':
            custom = '{"sensors"}'
    if tag == 'span' and not any(isinstance(c, Node) for c in node.children):
        raw = ''.join(node.children).strip()
        replacements = {'ARMED & SENSING': '{ui.mode === "disarm" ? "DISARMED" : "ARMED & SENSING"}', 'SYSTEM SECURE': '{ui.mode === "disarm" ? "SYSTEM DISARMED" : "SYSTEM SECURE"}'}
        if raw in replacements:
            custom = replacements[raw]
    aliases = {'class': 'className', 'for': 'htmlFor', 'viewbox': 'viewBox', 'tabindex': 'tabIndex', 'crossorigin': 'crossOrigin', 'stroke-width': 'strokeWidth', 'stroke-dasharray': 'strokeDasharray', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule'}
    rendered = []
    for key, value in attrs.items():
        if key.startswith('on'):
            continue
        key = aliases.get(key, key)
        if key == 'style':
            style = {}
            for decl in value.split(';'):
                if ':' in decl:
                    k, v = decl.split(':', 1)
                    style[camel(k.strip())] = v.strip()
            rendered.append('style={' + json.dumps(style) + '}')
        elif key in {'checked', 'selected'}:
            rendered.append(('defaultChecked' if key == 'checked' else 'defaultValue') + '={true}')
        else:
            if key == 'value':
                key = 'defaultValue'
            rendered.append(key + ('={true}' if value is None else '=' + json.dumps(value, ensure_ascii=False)))
    opening = '<' + tag + ' ' + ' '.join(rendered + extra)
    content = custom if custom is not None else ''.join(jsx(c, article) for c in node.children)
    result = opening + (' />' if tag in VOID else '>' + content + '</' + tag + '>')
    if tag == 'article':
        result = '{!ui.revoked.includes(' + json.dumps(article) + ') && (' + result + ')}'
    if ident == 'tab-scheduled-content':
        result = '{ui.tab === "scheduled" && (<>' + result + '<VisitorCards ui={ui} act={act} once={false} /></>)}{ui.tab === "passes" && <VisitorCards ui={ui} act={act} once />}'
    if tag == 'section' and 'ESP32 & System' in label:
        attrs['id'] = 'security-rules'
    return result

screens = [('sentinel_ai_home_dashboard', 'HomeDashboard'), ('sentinel_ai_live_security_monitor', 'LiveSecurityMonitor'), ('sentinel_ai_conversational_verification', 'ConversationalVerification'), ('sentinel_ai_visitor_management_rules', 'VisitorManagement')]
for folder, name in screens:
    html = (SOURCE / folder / 'code.html').read_text(encoding='utf-8')
    parser = Parser()
    parser.feed(html)
    main = find(parser.root, 'main')
    content = jsx(main)
    if name == 'VisitorManagement':
        content = content.replace('<section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-space-md"', '<section id="security-rules" className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-space-md"')
    imports = 'import { VisitorCards } from "../components/VisitorCards.jsx";\n' if name == 'VisitorManagement' else ''
    (OUT / (name + '.jsx')).write_text(imports + 'export default function ' + name + '({ ui, act }) {\nreturn (' + content + ');\n}\n', encoding='utf-8')
    if name == 'HomeDashboard':
        (ROOT / 'src/components').mkdir(exist_ok=True)
        (ROOT / 'src/components/Header.jsx').write_text('export default function Header({ act }) { return (' + jsx(find(parser.root, 'header')) + '); }\n', encoding='utf-8')
        config = re.search(r'tailwind.config\s*=\s*(.*?);</script>', html, re.S)[1]
        (ROOT / 'tailwind.config.js').write_text('export default { content: ["./index.html", "./src/**/*.{js,jsx}"], ...' + config + ' };\n', encoding='utf-8')
(ROOT / 'stitch-assets.json').write_text(json.dumps(assets, indent=2), encoding='utf-8')
print('Generated four JSX screens, shared header, Tailwind theme, and asset manifest.')
