import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, getSession, streamApiPost } from '../../api.js';
import { DeleteConfirmModal } from '../PremiumUI';

interface VoiceScreenProps {
  onUnlockDoor?: () => void;
}

interface InterviewQuestion {
  question_id?: number | string;
  id?: number | string;
  session_id?: number | string;
  question_text?: string;
  question_order?: number;
  created_at?: string;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'visitor' | 'operator' | 'system';
  text: string;
  time: string;
  questionId?: number | string;
}

interface PresenceUser {
  user_id: string | number;
  full_name?: string;
  email?: string;
  role?: string;
  residence?: string;
  online?: boolean;
}

interface CommunicationMessage {
  message_id: string | number;
  sender_user_id: string;
  recipient_user_id: string;
  message: string;
  created_at: string;
  attachment_data?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
  is_mine?: boolean;
}

interface CommunicationGroup {
  group_id: string | number;
  group_name: string;
  member_user_ids?: string[];
  member_count?: number;
}

interface GroupMessage {
  message_id: string | number;
  group_id: string | number;
  sender_user_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
  is_mine?: boolean;
}

function formatTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function orderQuestions(questions: InterviewQuestion[]) {
  return [...questions].sort((left, right) => {
    const leftOrder = Number(left.question_order ?? 0);
    const rightOrder = Number(right.question_order ?? 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.question_id ?? left.id ?? '').localeCompare(String(right.question_id ?? right.id ?? ''));
  });
}

export const VoiceScreen: React.FC<VoiceScreenProps> = ({ onUnlockDoor }) => {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [visitorMessages, setVisitorMessages] = useState<ChatMessage[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionError, setQuestionError] = useState('');
  const [isMicActive, setIsMicActive] = useState(true);
  const [isTakeoverActive, setIsTakeoverActive] = useState(false);
  const [isAiInterrupted, setIsAiInterrupted] = useState(false);
  const [unlockedSuccess, setUnlockedSuccess] = useState(false);
  const [userCustomInput, setUserCustomInput] = useState('');
  const [aiConnectionStatus, setAiConnectionStatus] = useState<'pending' | 'connecting' | 'connected' | 'error'>('pending');
  const [showAiChatModal, setShowAiChatModal] = useState(false);
  const [people, setPeople] = useState<PresenceUser[]>([]);
  const [visitors, setVisitors] = useState<PresenceUser[]>([]);
  const [groupChats, setGroupChats] = useState<CommunicationGroup[]>([]);
  const [groupPage, setGroupPage] = useState(1);
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'residence' | 'admin'>('all');
  const [peoplePage, setPeoplePage] = useState(1);
  const [visitorPage, setVisitorPage] = useState(1);
  const [peopleError, setPeopleError] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PresenceUser | null>(null);
  const [communicationMessages, setCommunicationMessages] = useState<CommunicationMessage[]>([]);
  const [communicationDraft, setCommunicationDraft] = useState('');
  const [communicationAttachment, setCommunicationAttachment] = useState<{ data: string; name: string; type: string; size: number } | null>(null);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [communicationError, setCommunicationError] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CommunicationGroup | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupDraft, setGroupDraft] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<CommunicationGroup | null>(null);
  const [deleteGroupBusy, setDeleteGroupBusy] = useState(false);
  const useMessengerWorkspace = true;
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const communicationEndRef = useRef<HTMLDivElement | null>(null);
  const groupEndRef = useRef<HTMLDivElement | null>(null);
  const currentUserId = String(getSession()?.user_id || '');
  const peoplePageSize = 10;
  const peoplePageCount = Math.max(1, Math.ceil(people.length / peoplePageSize));
  const visiblePeople = people.slice((peoplePage - 1) * peoplePageSize, peoplePage * peoplePageSize);
  const groupPageSize = 10;
  const groupPageCount = Math.max(1, Math.ceil(groupChats.length / groupPageSize));
  const visibleGroups = groupChats.slice((groupPage - 1) * groupPageSize, groupPage * groupPageSize);
  const visitorPageSize = 10;
  const visitorPageCount = Math.max(1, Math.ceil(visitors.length / visitorPageSize));
  const visibleVisitors = visitors.slice((visitorPage - 1) * visitorPageSize, visitorPage * visitorPageSize);

  async function loadQuestions() {
    setLoadingQuestions(true);
    setQuestionError('');
    try {
      setQuestions(orderQuestions(await apiGet('/interview/questions')));
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : 'Unable to load interview questions.');
    } finally {
      setLoadingQuestions(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    const openAiChat = () => setShowAiChatModal(true);
    window.addEventListener('sentinel-open-ai-chat', openAiChat);
    return () => window.removeEventListener('sentinel-open-ai-chat', openAiChat);
  }, []);

  async function loadPeople(filter = peopleFilter) {
    setPeopleError('');
    try {
      const result = await apiGet(`/communicate/people?filter=${filter}`);
      setPeople(result.filter((person: PresenceUser) => person.role !== 'VISITOR'));
    } catch (error) {
      setPeopleError(error instanceof Error ? error.message : 'Unable to load online users.');
    }
  }

  async function loadVisitors() {
    try {
      const result = await apiGet('/communicate/people?filter=all');
      setVisitors(result.filter((person: PresenceUser) => person.role === 'VISITOR'));
    } catch (error) {
      setPeopleError(error instanceof Error ? error.message : 'Unable to load visitors.');
    }
  }

  async function loadGroupChats() {
    try {
      setGroupChats(await apiGet('/communicate/groups'));
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to load group chats.');
    }
  }

  useEffect(() => {
    setGroupPage(1);
  }, [groupChats.length]);

  function requestDeleteCommunicationGroup(group: CommunicationGroup) {
    setCommunicationError('');
    setDeleteGroupTarget(group);
  }

  async function confirmDeleteCommunicationGroup() {
    if (!deleteGroupTarget) return;
    setDeleteGroupBusy(true);
    try {
      const groupId = String(deleteGroupTarget.group_id);
      await apiDelete(`/communicate/groups/${encodeURIComponent(groupId)}`);
      setGroupChats((current) => current.filter((item) => String(item.group_id) !== groupId));
      if (String(selectedGroup?.group_id) === groupId) setSelectedGroup(null);
      setDeleteGroupTarget(null);
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to delete group chat.');
    } finally {
      setDeleteGroupBusy(false);
    }
  }

  useEffect(() => {
    loadPeople();
    loadVisitors();
    loadGroupChats();
    apiPost('/communicate/heartbeat').catch(() => undefined);
    const heartbeat = window.setInterval(() => {
      apiPost('/communicate/heartbeat').catch(() => undefined);
      loadPeople();
      loadVisitors();
    }, 60000);
    return () => window.clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    loadPeople(peopleFilter);
  }, [peopleFilter]);

  useEffect(() => {
    setPeoplePage(1);
  }, [peopleFilter, people.length]);

  useEffect(() => {
    setVisitorPage(1);
  }, [visitors.length]);

  async function openCommunication(person: PresenceUser) {
    setSelectedPerson(person);
    setSelectedGroup(null);
    setCommunicationLoading(true);
    setCommunicationError('');
    try {
      setCommunicationMessages(await apiGet(`/communicate/messages/${encodeURIComponent(String(person.user_id))}`));
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to load conversation.');
    } finally {
      setCommunicationLoading(false);
    }
  }

  async function sendCommunication(event: React.FormEvent) {
    event.preventDefault();
    const message = communicationDraft.trim();
    if ((!message && !communicationAttachment) || !selectedPerson) return;
    setCommunicationError('');
    try {
      const created = await apiPost('/communicate/messages', {
        recipient_user_id: String(selectedPerson.user_id),
        message,
        attachment_data: communicationAttachment?.data || '',
        attachment_name: communicationAttachment?.name || '',
        attachment_type: communicationAttachment?.type || '',
        attachment_size: communicationAttachment?.size || 0,
      });
      setCommunicationMessages((current) => [...current, created]);
      setCommunicationDraft('');
      setCommunicationAttachment(null);
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to send message.');
    }
  }

  function handleCommunicationAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const supported = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') || ['application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type);
    if (file.size > 8 * 1024 * 1024) { setCommunicationError('Attachments must be 8 MB or smaller.'); return; }
    if (!supported) { setCommunicationError('This file type is not supported.'); return; }
    const reader = new FileReader();
    reader.onload = () => setCommunicationAttachment({ data: String(reader.result), name: file.name, type: file.type || 'application/octet-stream', size: file.size });
    reader.onerror = () => setCommunicationError('Unable to read that file.');
    reader.readAsDataURL(file);
  }

  function renderAttachment(message: CommunicationMessage) {
    if (!message.attachment_data) return null;
    const data = String(message.attachment_data);
    if (message.attachment_type?.startsWith('image/') && data.startsWith('data:')) return <img src={data} alt={message.attachment_name || 'Attached image'} className="communication-attachment-image" />;
    if (message.attachment_type?.startsWith('video/') && data.startsWith('data:')) return <video controls preload="metadata" className="communication-attachment-media"><source src={data} type={message.attachment_type} /></video>;
    if (message.attachment_type?.startsWith('audio/') && data.startsWith('data:')) return <audio controls preload="metadata" className="communication-attachment-audio"><source src={data} type={message.attachment_type} /></audio>;
    return <a className="communication-attachment-file" href={data} download={message.attachment_name || 'attachment'}><span className="material-symbols-outlined">download</span>{message.attachment_name || 'Download attachment'}</a>;
  }

  function toggleGroupMember(userId: string) {
    setGroupMembers((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  }

  async function createCommunicationGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!groupName.trim() || !groupMembers.length) return;
    setGroupSaving(true);
    setCommunicationError('');
    try {
      const created = await apiPost('/communicate/groups', { name: groupName.trim(), member_user_ids: groupMembers });
      setSelectedGroup(created);
      setGroupMessages([]);
      setShowGroupModal(false);
      setGroupName('');
      setGroupMembers([]);
      setCommunicationError('');
      await Promise.all([loadPeople(), loadGroupChats()]);
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to create communication group.');
    } finally {
      setGroupSaving(false);
    }
  }

  async function openGroup(group: CommunicationGroup) {
    setSelectedGroup(group);
    setSelectedPerson(null);
    setGroupLoading(true);
    try {
      setGroupMessages(await apiGet(`/communicate/groups/${encodeURIComponent(String(group.group_id))}/messages`));
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to load group conversation.');
    } finally {
      setGroupLoading(false);
    }
  }

  async function sendGroupCommunication(event: React.FormEvent) {
    event.preventDefault();
    const message = groupDraft.trim();
    if (!message || !selectedGroup) return;
    try {
      const created = await apiPost('/communicate/groups/messages', { group_id: selectedGroup.group_id, message });
      setGroupMessages((current) => [...current, created]);
      setGroupDraft('');
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Unable to send group message.');
    }
  }

  function personInitials(person: PresenceUser) {
    return (person.full_name || person.email || 'User').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  }

  const aiMessages = useMemo<ChatMessage[]>(() => {
    return orderQuestions(questions).map((question, index) => ({
      id: `question-${question.question_id ?? question.id ?? index}`,
      sender: 'ai',
      text: question.question_text || 'Interview question',
      time: formatTime(question.created_at),
      questionId: question.question_id ?? question.id,
    }));
  }, [questions]);

  const dialogue = useMemo(() => {
    return [...aiMessages, ...visitorMessages];
  }, [aiMessages, visitorMessages]);

  const answeredCount = Math.min(visitorMessages.filter((message) => message.sender !== 'ai').length, questions.length);
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const activeQuestion = questions[Math.min(answeredCount, Math.max(questions.length - 1, 0))];
  const statusLabel = questions.length && answeredCount >= questions.length ? 'COMPLETE' : 'IN PROGRESS';
  const declaredPurpose = visitorMessages[0]?.text || 'Awaiting visitor response';
  const matchedRule = questions[0]?.question_text || 'Waiting for interview question';

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [dialogue.length]);

  useEffect(() => {
    communicationEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [communicationMessages.length, communicationLoading, selectedPerson]);

  useEffect(() => {
    groupEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [groupMessages.length, groupLoading, selectedGroup]);

  const handleToggleMic = () => {
    setIsMicActive(!isMicActive);
  };

  const handleInterruptAi = () => {
    setIsAiInterrupted(!isAiInterrupted);
  };

  const handleTakeover = () => {
    setIsTakeoverActive(!isTakeoverActive);
  };

  const handleUnlockClick = () => {
    setUnlockedSuccess(true);
    if (onUnlockDoor) onUnlockDoor();
    setTimeout(() => setUnlockedSuccess(false), 3000);
  };

  const handleSendTestUtterance = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = userCustomInput.trim();
    if (!text) return;

    const sender = 'operator';
    const nextMessage: ChatMessage = {
      id: `${sender}-${Date.now()}`,
      sender,
      time: formatTime(),
      text,
      questionId: activeQuestion?.question_id ?? activeQuestion?.id,
    };

    setVisitorMessages((prev) => [...prev, nextMessage]);
    setUserCustomInput('');

    if (!isTakeoverActive) {
      try {
        setAiConnectionStatus('connecting');
        if (activeQuestion) {
          await apiPost('/interview/response', {
            session_id: activeQuestion.session_id,
            question_id: activeQuestion.question_id ?? activeQuestion.id,
            recognized_text: text,
            confidence: 94,
            evaluation_result: answeredCount + 1 >= questions.length ? 'AUTHORIZED' : 'IN_PROGRESS',
          });
        }
        const aiMessageId = `ai-${Date.now()}`;
        setVisitorMessages((prev) => [...prev, { id: aiMessageId, sender: 'ai', time: formatTime(), text: '' }]);
        await streamApiPost('/ai/chat', {
          message: text,
          context: {
            role: 'admin_access_control',
            active_question: activeQuestion?.question_text || 'No database policy question is currently loaded.',
            progress: questions.length ? `${answeredCount + 1}/${questions.length}` : 'No questions loaded',
          },
        }, (eventName, payload) => {
          if (eventName === 'error') throw new Error(payload.error || 'AI response failed.');
          if (eventName === 'delta') setVisitorMessages((prev) => prev.map((item) => item.id === aiMessageId ? { ...item, text: `${item.text}${payload.text || ''}` } : item));
        });
        setAiConnectionStatus('connected');
      } catch (error) {
        setAiConnectionStatus('error');
        setQuestionError(error instanceof Error ? error.message : 'Could not complete the admin access-control request.');
      }
    }
  };

  return (
    <div className="communication-page-shell messenger-only-page flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      <div className="communication-ai-header flex flex-col bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-sm gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-[11px] uppercase tracking-wider font-bold">
                {isMicActive ? 'Listening & Verifying' : 'Intercom Standby'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-on-surface-variant font-mono text-[12px]">
              <span className="material-symbols-outlined text-[16px] text-secondary">sensors</span>
              <span>PIR Zone 1</span>
            </div>
          </div>
          <button
            type="button"
            onClick={loadQuestions}
            className="self-start sm:self-auto h-8 px-3 rounded-full bg-surface-container text-primary text-[11px] font-bold flex items-center gap-1.5 hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">sync</span>
            Refresh Questions
          </button>
        </div>

        <div className="flex flex-col mt-1">
          <h1 className="font-display font-bold text-2xl text-on-surface tracking-tight">
            AI Security Assistant
          </h1>
          <p className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-[15px] text-tertiary">
              motion_sensor_active
            </span>
            <span>Interview questions streamed from PostgreSQL verification rules</span>
          </p>
        </div>
      </div>

      <div className="communication-chat-grid grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="communication-chat-column lg:col-span-12 flex flex-col gap-4">
          <div className="messenger-workspace">
            <aside className="messenger-sidebar" aria-label="Conversation list">
              <div className="messenger-sidebar-header">
                <div><span className="communication-eyebrow">SECURE INBOX</span><h2>Conversations</h2></div>
                <span className="messenger-online-count"><i />{people.filter((person) => person.online).length} online</span>
              </div>
              <button type="button" className="messenger-new-group" onClick={() => { setShowGroupModal(true); setCommunicationError(''); }}><span className="material-symbols-outlined">group_add</span><span><strong>New group chat</strong><small>Start a shared secure channel</small></span><span className="material-symbols-outlined">add</span></button>
              <div className="messenger-filters" role="tablist" aria-label="Conversation filters">
                {([['all', 'All'], ['residence', 'Residents'], ['admin', 'Admins']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={peopleFilter === value} onClick={() => { setPeoplePage(1); setPeopleFilter(value); }}>{label}</button>)}
              </div>
              <div className="messenger-list">
                {visiblePeople.filter((person) => String(person.user_id) !== currentUserId).map((person) => <button type="button" key={person.user_id} className={`messenger-list-item ${String(selectedPerson?.user_id) === String(person.user_id) ? 'active' : ''}`} onClick={() => openCommunication(person)}><span className="communication-avatar"><span>{personInitials(person)}</span><i className={person.online ? 'online' : ''} /></span><span className="messenger-list-copy"><strong>{person.full_name || person.email}</strong><small>{person.online ? 'Online now' : 'Offline'} · {person.role === 'ADMIN' ? 'Administrator' : person.residence || 'Resident'}</small></span>{Number(person.unread_count || 0) > 0 && <b className="messenger-unread">{person.unread_count}</b>}</button>)}
                {visibleVisitors.map((visitor) => <button type="button" key={visitor.user_id} className={`messenger-list-item ${String(selectedPerson?.user_id) === String(visitor.user_id) ? 'active' : ''}`} onClick={() => openCommunication(visitor)}><span className="communication-avatar"><span>{personInitials(visitor)}</span><i className={visitor.online ? 'online' : ''} /></span><span className="messenger-list-copy"><strong>{visitor.full_name || 'Unnamed visitor'}</strong><small>{visitor.online ? 'Online now' : 'Visitor intake'}</small></span>{Number(visitor.unread_count || 0) > 0 && <b className="messenger-unread">{visitor.unread_count}</b>}</button>)}
                {visibleGroups.map((group) => <button type="button" key={group.group_id} className={`messenger-list-item ${String(selectedGroup?.group_id) === String(group.group_id) ? 'active' : ''}`} onClick={() => openGroup(group)}><span className="communication-group-icon"><span className="material-symbols-outlined">groups</span></span><span className="messenger-list-copy"><strong>{group.group_name}</strong><small>{group.member_count || group.member_user_ids?.length || 0} members · Group</small></span></button>)}
                {!people.length && !visitors.length && !groupChats.length && <p className="communication-empty">No conversations yet.</p>}
              </div>
              <div className="messenger-pagination">
                <span>{people.length + visitors.length + groupChats.length} conversations</span>
                <div><button type="button" onClick={() => { setPeoplePage((page) => Math.max(1, page - 1)); setVisitorPage((page) => Math.max(1, page - 1)); setGroupPage((page) => Math.max(1, page - 1)); }} disabled={peoplePage === 1} aria-label="Previous conversations"><span className="material-symbols-outlined">chevron_left</span></button><strong>{peoplePage} / {Math.max(peoplePageCount, visitorPageCount, groupPageCount)}</strong><button type="button" onClick={() => { const lastPage = Math.max(peoplePageCount, visitorPageCount, groupPageCount); setPeoplePage((page) => Math.min(lastPage, page + 1)); setVisitorPage((page) => Math.min(lastPage, page + 1)); setGroupPage((page) => Math.min(lastPage, page + 1)); }} disabled={peoplePage >= Math.max(peoplePageCount, visitorPageCount, groupPageCount)} aria-label="Next conversations"><span className="material-symbols-outlined">chevron_right</span></button></div>
              </div>
            </aside>
            <section className="messenger-thread-panel" aria-label="Active conversation">
              {(selectedPerson || selectedGroup) ? <>
                <header className="messenger-thread-header">
                  <div className={selectedGroup ? 'communication-group-icon' : 'communication-avatar large'}>{selectedGroup ? <span className="material-symbols-outlined">groups</span> : <><span>{personInitials(selectedPerson as PresenceUser)}</span><i className={(selectedPerson as PresenceUser).online ? 'online' : ''} /></>}</div>
                  <div><h2>{selectedGroup ? selectedGroup.group_name : selectedPerson?.full_name || selectedPerson?.email}</h2><p>{selectedGroup ? `${selectedGroup.member_count || selectedGroup.member_user_ids?.length || 0} members · Shared secure channel` : selectedPerson?.online ? 'Online now · Secure conversation' : 'Conversation history'}</p></div>
                  <button type="button" className="messenger-thread-close" onClick={() => { setSelectedPerson(null); setSelectedGroup(null); }} aria-label="Close conversation"><span className="material-symbols-outlined">close</span></button>
                </header>
                <div className="messenger-messages" aria-live="polite">
                  {selectedGroup ? <>{groupLoading && <p className="communication-empty">Loading messages...</p>}{!groupLoading && !groupMessages.length && <p className="communication-empty">Start the group conversation.</p>}{!groupLoading && groupMessages.map((message) => <div key={message.message_id} className={`communication-bubble ${message.is_mine ? 'outgoing' : 'incoming'}`}><span>{message.message}</span><small>{message.sender_name || (message.is_mine ? 'You' : 'Member')} · {formatTime(message.created_at)}</small></div>)}</> : <>{communicationLoading && <p className="communication-empty">Loading messages...</p>}{!communicationLoading && !communicationMessages.length && <p className="communication-empty">Start a secure conversation.</p>}{!communicationLoading && communicationMessages.map((message) => <div key={message.message_id} className={`communication-bubble ${message.is_mine ? 'outgoing' : 'incoming'}`}><span>{message.message && <span>{message.message}</span>}{renderAttachment(message)}</span><small>{formatTime(message.created_at)}</small></div>)}</>}
                  <div ref={selectedGroup ? groupEndRef : communicationEndRef} />
                </div>
                {communicationError && <p className="communication-error modal-error">{communicationError}</p>}
                {selectedGroup ? <form className="messenger-composer" onSubmit={sendGroupCommunication}><input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} maxLength={2000} placeholder="Write a group message..." /><button type="submit" disabled={!groupDraft.trim()} aria-label="Send message"><span className="material-symbols-outlined">send</span></button></form> : <form className="messenger-composer" onSubmit={sendCommunication}><label className="communication-attach-button" aria-label="Attach a file" title="Attach a file"><input type="file" accept="image/*,video/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx" onChange={handleCommunicationAttachment} /><span className="material-symbols-outlined">attach_file</span></label><input value={communicationDraft} onChange={(event) => setCommunicationDraft(event.target.value)} maxLength={2000} placeholder="Write a secure message..." /><button type="submit" disabled={!communicationDraft.trim() && !communicationAttachment} aria-label="Send message"><span className="material-symbols-outlined">send</span></button></form>}
              </> : <div className="messenger-empty-state"><span className="material-symbols-outlined">forum</span><h2>Select a conversation</h2><p>Choose a person, visitor, or group from the inbox to start messaging.</p></div>}
            </section>
          </div>

          <div className="communication-presence-panel legacy-communication-list">
              <div className="communication-presence-heading">
                <div>
                  <span className="communication-eyebrow">PEOPLE ONLINE</span>
                  <strong>Secure communication</strong>
                </div>
                <span className="communication-count">{people.length} available</span>
              </div>
              <button type="button" className="communication-create-group" onClick={() => { setShowGroupModal(true); setCommunicationError(''); }}>
                <span className="material-symbols-outlined">group_add</span>
                <span><strong>Create chat group</strong><small>Select specific users for a shared secure channel.</small></span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <div className="communication-filters" role="tablist" aria-label="Filter people">
                {([
                  ['all', 'All people'],
                  ['residence', 'Residence'],
                  ['admin', 'Admin'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={peopleFilter === value} onClick={() => { setPeoplePage(1); setPeopleFilter(value); }}>
                    {label}
                  </button>
                ))}
              </div>
              {peopleError && <p className="communication-error">{peopleError}</p>}
              {!peopleError && people.length === 0 && <p className="communication-empty">No available users found.</p>}
              <div className="communication-people-list">
                {visiblePeople.map((person) => (
                  <button key={person.user_id} type="button" className="communication-person" onClick={() => openCommunication(person)} disabled={String(person.user_id) === currentUserId}>
                    <span className="communication-avatar"><span>{personInitials(person)}</span><i className={person.online ? 'online' : ''} /></span>
                    <span className="communication-person-copy"><strong>{person.full_name || person.email}</strong><small>{person.role === 'ADMIN' ? 'Administrator' : person.residence || 'Residence'}</small></span>
                    <span className="material-symbols-outlined communication-person-arrow">chat_bubble</span>
                  </button>
                ))}
              </div>
              {people.length > peoplePageSize && (
                <div className="communication-pagination" aria-label="People pagination">
                  <span>Showing {(peoplePage - 1) * peoplePageSize + 1}-{Math.min(peoplePage * peoplePageSize, people.length)} of {people.length}</span>
                  <div>
                    <button type="button" onClick={() => setPeoplePage((page) => Math.max(1, page - 1))} disabled={peoplePage === 1} aria-label="Previous people page"><span className="material-symbols-outlined">chevron_left</span></button>
                    <strong>{peoplePage} / {peoplePageCount}</strong>
                    <button type="button" onClick={() => setPeoplePage((page) => Math.min(peoplePageCount, page + 1))} disabled={peoplePage === peoplePageCount} aria-label="Next people page"><span className="material-symbols-outlined">chevron_right</span></button>
                  </div>
                </div>
              )}
              <section className="communication-visitors-section" aria-labelledby="visitors-heading">
                <div className="communication-presence-heading">
                  <div>
                    <span className="communication-eyebrow">VISITORS</span>
                    <strong id="visitors-heading">Visitor conversations</strong>
                  </div>
                  <span className="communication-count">{visitors.length} total</span>
                </div>
                {!peopleError && visitors.length === 0 && <p className="communication-empty">No visitor conversations yet.</p>}
                <div className="communication-people-list">
                  {visibleVisitors.map((visitor) => (
                    <button key={visitor.user_id} type="button" className="communication-person" onClick={() => openCommunication(visitor)}>
                      <span className="communication-avatar"><span>{personInitials(visitor)}</span><i className={visitor.online ? 'online' : ''} /></span>
                      <span className="communication-person-copy"><strong>{visitor.full_name || 'Unnamed visitor'}</strong><small>Visitor intake{visitor.online ? ' · Online now' : ''}</small></span>
                      <span className="material-symbols-outlined communication-person-arrow">chat_bubble</span>
                    </button>
                  ))}
                </div>
                {visitors.length > visitorPageSize && (
                  <div className="communication-pagination" aria-label="Visitor pagination">
                    <span>Showing {(visitorPage - 1) * visitorPageSize + 1}-{Math.min(visitorPage * visitorPageSize, visitors.length)} of {visitors.length}</span>
                    <div>
                      <button type="button" onClick={() => setVisitorPage((page) => Math.max(1, page - 1))} disabled={visitorPage === 1} aria-label="Previous visitor page"><span className="material-symbols-outlined">chevron_left</span></button>
                      <strong>{visitorPage} / {visitorPageCount}</strong>
                      <button type="button" onClick={() => setVisitorPage((page) => Math.min(visitorPageCount, page + 1))} disabled={visitorPage === visitorPageCount} aria-label="Next visitor page"><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>
                  </div>
                )}
              </section>
              {groupChats.length > 0 && <div className="communication-created-groups">
                <span className="communication-eyebrow">CREATED GROUP CHATS</span>
                <div className="communication-created-group-list">
                  {visibleGroups.map((group) => <button type="button" key={group.group_id} onClick={() => openGroup(group)}>
                    <span className="communication-group-icon"><span className="material-symbols-outlined">groups</span></span>
                    <span><strong>{group.group_name}</strong><small>{group.member_count || group.member_user_ids?.length || 0} members · Shared secure channel</small></span>
                    <span className="communication-created-group-actions"><span className="material-symbols-outlined">arrow_forward</span><span role="button" tabIndex={0} className="material-symbols-outlined communication-group-delete" aria-label={`Delete ${group.group_name}`} onClick={(event) => { event.stopPropagation(); requestDeleteCommunicationGroup(group); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); requestDeleteCommunicationGroup(group); } }}>delete</span></span>
                  </button>)}
                </div>
                {groupChats.length > groupPageSize && <div className="communication-pagination"><span>Showing {(groupPage - 1) * groupPageSize + 1}-{Math.min(groupPage * groupPageSize, groupChats.length)} of {groupChats.length}</span><div><button type="button" onClick={() => setGroupPage((page) => Math.max(1, page - 1))} disabled={groupPage === 1} aria-label="Previous group page"><span className="material-symbols-outlined">chevron_left</span></button><strong>{groupPage} / {groupPageCount}</strong><button type="button" onClick={() => setGroupPage((page) => Math.min(groupPageCount, page + 1))} disabled={groupPage === groupPageCount} aria-label="Next group page"><span className="material-symbols-outlined">chevron_right</span></button></div></div>}
              </div>}
            </div>

          <div className="flex flex-col gap-2">
            {showAiChatModal && <div className="ai-chat-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAiChatModal(false); }}>
            <section className="ai-chat-modal flex flex-col bg-surface-container-low rounded-xl border border-surface-container overflow-hidden shadow-sm" role="dialog" aria-modal="true" aria-labelledby="ai-chat-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest border-b border-surface-container">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-primary text-on-primary grid place-items-center shadow-xs">
                    <span className="material-symbols-outlined text-[19px]">smart_toy</span>
                  </span>
                  <div className="min-w-0">
                    <p id="ai-chat-title" className="text-sm font-display font-semibold text-on-surface truncate">Sentinel AI Assistant</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {aiConnectionStatus === 'connected'
                        ? `ChatGPT connected · ${questions.length} database prompts ready`
                        : aiConnectionStatus === 'connecting'
                        ? 'Connecting to ChatGPT...'
                        : aiConnectionStatus === 'error'
                        ? 'ChatGPT connection unavailable'
                        : loadingQuestions
                        ? 'Syncing questions...'
                        : `ChatGPT ready · ${questions.length} database prompts ready`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${aiConnectionStatus === 'error' ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${aiConnectionStatus === 'error' ? 'bg-error' : 'bg-primary'} ${aiConnectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
                    {aiConnectionStatus === 'error' ? 'Offline' : aiConnectionStatus === 'connecting' ? 'Connecting' : 'ChatGPT'}
                  </span>
                  <button type="button" className="ai-chat-modal-close" onClick={() => setShowAiChatModal(false)} aria-label="Close AI assistant chat">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4 sm:p-5 max-h-[520px] overflow-y-auto">
                {loadingQuestions && (
                  <div className="py-10 text-center text-sm text-on-surface-variant">Loading interview questions...</div>
                )}
                {!loadingQuestions && questionError && (
                  <div className="rounded-xl bg-error-container p-3 text-xs font-semibold text-on-error-container">
                    {questionError}
                  </div>
                )}

                {!loadingQuestions && !questionError && dialogue.map((msg) => {
                  const isAi = msg.sender === 'ai';
                  const isOperator = msg.sender === 'operator';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col space-y-1 max-w-[86%] ${
                        isAi ? 'items-start' : 'items-end self-end'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 px-1">
                        {isAi ? (
                          <>
                            <span className="material-symbols-outlined text-[14px] text-primary">smart_toy</span>
                            <span className="text-[11px] text-primary font-bold">AI Assistant</span>
                          </>
                        ) : isOperator ? (
                          <>
                            <span className="text-[11px] text-primary font-bold">Admin Control</span>
                            <span className="material-symbols-outlined text-[14px] text-primary">support_agent</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] text-secondary font-bold">Admin Operator</span>
                            <span className="material-symbols-outlined text-[14px] text-secondary">record_voice_over</span>
                          </>
                        )}
                        <span className="font-mono text-[10px] text-on-surface-variant/70">{msg.time}</span>
                      </div>

                      <div
                        className={`p-3 text-xs leading-relaxed shadow-xs ${
                          isAi
                            ? 'bg-surface-container-lowest text-on-surface rounded-2xl rounded-tl-sm'
                            : isOperator
                            ? 'bg-primary text-white rounded-2xl rounded-tr-sm'
                            : 'bg-secondary-fixed text-on-secondary-fixed rounded-2xl rounded-tr-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={transcriptEndRef} />
              </div>

              <form onSubmit={handleSendTestUtterance} className="flex gap-2 p-3 bg-surface-container-lowest border-t border-surface-container">
                <input
                  type="text"
                  value={userCustomInput}
                  onChange={(e) => setUserCustomInput(e.target.value)}
                  placeholder={
                    isTakeoverActive
                      ? 'Enter an admin access-control instruction...'
                      : 'Ask ChatGPT about access control...'
                  }
                  className="flex-1 h-10 px-3.5 rounded-xl bg-surface-container-low text-xs border border-surface-container focus:outline-none focus:border-primary text-on-surface placeholder:text-outline"
                />
                <button
                  type="submit"
                  className="px-4 h-10 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shrink-0 shadow-xs"
                >
                  Send
                </button>
              </form>
            </section>
            </div>}
          </div>
        </div>

        {false && <div className="lg:col-span-5 flex flex-col gap-4">
          {unlockedSuccess && (
            <div className="bg-[#eff4ff] border border-primary text-primary p-3 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">door_open</span>
                <span className="text-xs font-semibold">Front Porch Strike Latch Unlocked</span>
              </div>
              <span className="text-[11px] font-mono font-bold">00:08</span>
            </div>
          )}

          <div className="w-full rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm flex flex-col items-center space-y-4 border border-surface-container">
            <span className="text-xs font-semibold text-on-surface uppercase tracking-wider">
              Perimeter Two-Way Intercom
            </span>

            <div className="w-full h-16 flex items-center justify-center gap-1.5 px-4 overflow-hidden bg-surface-container-low rounded-xl py-2">
              {[
                { h: 'h-3', delay: '0ms', color: 'bg-primary/40' },
                { h: 'h-6', delay: '100ms', color: 'bg-primary/60' },
                { h: 'h-10', delay: '250ms', color: 'bg-primary' },
                { h: 'h-12', delay: '150ms', color: 'bg-primary-container' },
                { h: 'h-8', delay: '300ms', color: 'bg-primary' },
                { h: 'h-5', delay: '200ms', color: 'bg-secondary-container' },
                { h: 'h-9', delay: '50ms', color: 'bg-secondary' },
                { h: 'h-14', delay: '350ms', color: 'bg-primary' },
                { h: 'h-11', delay: '180ms', color: 'bg-primary-container' },
                { h: 'h-6', delay: '220ms', color: 'bg-primary' },
                { h: 'h-8', delay: '310ms', color: 'bg-secondary' },
                { h: 'h-12', delay: '90ms', color: 'bg-primary/80' },
                { h: 'h-7', delay: '170ms', color: 'bg-primary/40' },
                { h: 'h-4', delay: '280ms', color: 'bg-primary/60' },
              ].map((bar, index) => (
                <span
                  key={index}
                  className={`w-1.5 rounded-full ${bar.color} ${bar.h} ${
                    isMicActive ? 'animate-pulse' : 'h-1.5'
                  }`}
                  style={{ animationDelay: bar.delay }}
                />
              ))}
            </div>

            <p className="text-[12px] text-center text-on-surface-variant italic px-2 leading-relaxed">
              {isTakeoverActive
                ? 'Operator takeover active: speaking directly to the front entrance speaker.'
                : 'Speak naturally. Sentinel AI is verifying the visit through database interview questions.'}
            </p>

            <div className="relative flex items-center justify-center my-2">
              {isMicActive && (
                <span className="absolute w-24 h-24 rounded-full bg-primary-fixed animate-ping opacity-30" />
              )}
              <button
                aria-label="Intercom Voice Activation"
                onClick={handleToggleMic}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  isMicActive ? 'bg-primary text-on-primary' : 'bg-secondary text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[36px]">
                  {isMicActive ? 'mic' : 'mic_off'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full pt-2">
              <button
                onClick={handleInterruptAi}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-colors min-h-[48px] ${
                  isAiInterrupted
                    ? 'bg-tertiary text-white'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-tertiary">
                  {isAiInterrupted ? 'play_arrow' : 'pause_circle'}
                </span>
                <span className="text-[11px] font-medium text-center leading-tight">
                  {isAiInterrupted ? 'Resume AI' : 'Interrupt AI'}
                </span>
              </button>

              <button
                onClick={handleTakeover}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-colors min-h-[48px] ${
                  isTakeoverActive
                    ? 'bg-secondary text-white'
                    : 'bg-secondary-fixed text-on-secondary-fixed hover:opacity-90'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
                <span className="text-[11px] font-semibold text-center leading-tight">
                  {isTakeoverActive ? 'Release Call' : 'Takeover'}
                </span>
              </button>

              <button
                onClick={handleUnlockClick}
                className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl bg-surface-container text-primary hover:bg-primary-fixed transition-colors min-h-[48px]"
              >
                <span className="material-symbols-outlined text-[22px]">lock_open</span>
                <span className="text-[11px] font-bold text-center leading-tight">Unlock</span>
              </button>
            </div>
          </div>
        </div>}
      </div>

      {!useMessengerWorkspace && selectedGroup && (
        <div className="communication-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGroup(null); }}>
          <section className="communication-modal" role="dialog" aria-modal="true" aria-labelledby="group-chat-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="communication-modal-header">
              <div className="communication-group-icon"><span className="material-symbols-outlined">groups</span></div>
              <div><span className="communication-eyebrow">SECURE GROUP CHANNEL</span><h2 id="group-chat-title">{selectedGroup.group_name}</h2><p>Private messages shared with the selected people.</p></div>
              <button type="button" className="communication-close" onClick={() => setSelectedGroup(null)} aria-label="Close group chat">×</button>
            </header>
            <div className="communication-thread" aria-live="polite">
              {groupLoading && <p className="communication-empty">Loading group conversation...</p>}
              {!groupLoading && groupMessages.length === 0 && <p className="communication-empty">Group created. Send the first message.</p>}
              {!groupLoading && groupMessages.map((message) => <div key={message.message_id} className={`communication-bubble ${String(message.sender_user_id) === currentUserId ? 'outgoing' : 'incoming'}`}><span>{message.message}</span><small><strong>{message.sender_name || (String(message.sender_user_id) === currentUserId ? 'You' : 'Member')}</strong> · {formatTime(message.created_at)}</small></div>)}
              <div ref={groupEndRef} />
            </div>
            {communicationError && <p className="communication-error modal-error">{communicationError}</p>}
            <form className="communication-composer" onSubmit={sendGroupCommunication}><input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} maxLength={2000} placeholder="Write to this group..." autoFocus /><button type="submit" disabled={!groupDraft.trim()} aria-label="Send group message"><span className="material-symbols-outlined">send</span></button></form>
            <small className="communication-modal-footer">Group messages are stored in the secure communication table.</small>
          </section>
        </div>
      )}

      {!useMessengerWorkspace && selectedPerson && (
        <div className="communication-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPerson(null); }}>
          <section className="communication-modal" role="dialog" aria-modal="true" aria-labelledby="communication-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="communication-modal-header">
              <div className="communication-avatar large"><span>{personInitials(selectedPerson)}</span><i className={selectedPerson.online ? 'online' : ''} /></div>
              <div><span className="communication-eyebrow">SECURE COMMUNICATION</span><h2 id="communication-title">Connect with {selectedPerson.role === 'ADMIN' ? 'an admin' : 'a resident'}</h2><p>Private messages saved to your Sentinel workspace.</p></div>
              <button type="button" className="communication-close" onClick={() => setSelectedPerson(null)} aria-label="Close communication">×</button>
            </header>
            <div className="communication-modal-people">
              <span className="communication-eyebrow">AVAILABLE PEOPLE</span>
              <div className="communication-modal-people-list">
                {people.filter((person) => String(person.user_id) !== currentUserId).map((person) => <button type="button" key={person.user_id} className={String(selectedPerson.user_id) === String(person.user_id) ? 'active' : ''} onClick={() => openCommunication(person)}><span className="communication-avatar"><span>{personInitials(person)}</span><i className={person.online ? 'online' : ''} /></span><span><strong>{person.full_name || person.email}</strong><small>{person.online ? 'Online now' : 'Available'} · {person.role === 'ADMIN' ? 'Administrator' : person.residence || 'Residence'}</small></span></button>)}
              </div>
            </div>
            <div className="communication-thread" aria-live="polite">
              {communicationLoading && <p className="communication-empty">Loading conversation...</p>}
              {!communicationLoading && communicationMessages.length === 0 && <p className="communication-empty">Start a private conversation with this person.</p>}
              {!communicationLoading && communicationMessages.map((message) => <div key={message.message_id} className={`communication-bubble ${String(message.sender_user_id) === currentUserId ? 'outgoing' : 'incoming'}`}><span>{message.message && <span>{message.message}</span>}{renderAttachment(message)}</span><small>{formatTime(message.created_at)}</small></div>)}
              <div ref={communicationEndRef} />
            </div>
            {communicationError && <p className="communication-error modal-error">{communicationError}</p>}
            <form className="communication-composer" onSubmit={sendCommunication}><label className="communication-attach-button" aria-label="Attach a file" title="Attach image, video, audio, or document"><input type="file" accept="image/*,video/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx" onChange={handleCommunicationAttachment} /><span className="material-symbols-outlined">attach_file</span></label><div className="communication-composer-main">{communicationAttachment && <span className="communication-attachment-chip"><span className="material-symbols-outlined">description</span>{communicationAttachment.name}<button type="button" onClick={() => setCommunicationAttachment(null)} aria-label="Remove attachment">close</button></span>}<input value={communicationDraft} onChange={(event) => setCommunicationDraft(event.target.value)} maxLength={2000} placeholder="Write a secure message..." autoFocus /></div><button type="submit" disabled={!communicationDraft.trim() && !communicationAttachment} aria-label="Send secure message"><span className="material-symbols-outlined">send</span></button></form>
            <small className="communication-modal-footer">Messages are stored in the secure communication table.</small>
          </section>
        </div>
      )}

      {showGroupModal && (
        <div className="communication-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !groupSaving) setShowGroupModal(false); }}>
          <section className="communication-group-modal" role="dialog" aria-modal="true" aria-labelledby="group-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="communication-modal-header">
              <div className="communication-group-icon"><span className="material-symbols-outlined">groups</span></div>
              <div><span className="communication-eyebrow">NEW SECURE CHANNEL</span><h2 id="group-title">Create chat group</h2><p>Add specific users to communicate together.</p></div>
              <button type="button" className="communication-close" onClick={() => setShowGroupModal(false)} disabled={groupSaving} aria-label="Close group creation">×</button>
            </header>
            <form onSubmit={createCommunicationGroup} className="communication-group-form">
              <label>Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} placeholder="Example: Residence security team" required /></label>
              <div className="communication-group-members"><span className="communication-eyebrow">SELECT USERS</span>{people.filter((person) => String(person.user_id) !== currentUserId).map((person) => { const id = String(person.user_id); return <label key={id} className={`communication-member-option ${groupMembers.includes(id) ? 'selected' : ''}`}><input type="checkbox" checked={groupMembers.includes(id)} onChange={() => toggleGroupMember(id)} /><span className="communication-avatar"><span>{personInitials(person)}</span><i className={person.online ? 'online' : ''} /></span><span><strong>{person.full_name || person.email}</strong><small>{person.role === 'ADMIN' ? 'Administrator' : person.residence || 'Residence'}</small></span><span className="material-symbols-outlined">{groupMembers.includes(id) ? 'check_circle' : 'add_circle'}</span></label> })}</div>
              {communicationError && <p className="communication-error">{communicationError}</p>}
              <div className="communication-group-actions"><button type="button" className="communication-secondary" onClick={() => setShowGroupModal(false)} disabled={groupSaving}>Cancel</button><button type="submit" className="communication-primary" disabled={groupSaving || !groupName.trim() || !groupMembers.length}>{groupSaving ? 'Creating...' : 'Create group'}</button></div>
            </form>
          </section>
        </div>
      )}

      <DeleteConfirmModal
        open={Boolean(deleteGroupTarget)}
        title={`Delete ${deleteGroupTarget?.group_name || 'this group'}?`}
        description="This permanently removes the group, its members, and every message from the secure communication channel."
        itemLabel={deleteGroupTarget ? deleteGroupTarget.group_name : undefined}
        busy={deleteGroupBusy}
        onCancel={() => { if (!deleteGroupBusy) setDeleteGroupTarget(null); }}
        onConfirm={confirmDeleteCommunicationGroup}
      />
    </div>
  );
};
