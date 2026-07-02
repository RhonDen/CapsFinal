import axios from 'axios';
import { ArrowLeft, Mail, MessageSquare, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';



const getAuthHeaders = () => ({});

const formatMessageMeta = (dateValue) => {

  const date = new Date(dateValue);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function Inbox() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [activeMessageId, setActiveMessageId] = useState('');







  const [query, setQuery] = useState('');




  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`/api/contact/messages`, { withCredentials: true });
        setMessages(response.data.messages || []);

      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to load inbox.');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);


  const sortedMessages = useMemo(
    () =>
      [...messages].sort((left, right) => {
        // Unread first
        if (!!left.read !== !!right.read) return left.read ? 1 : -1;
        return new Date(right.createdAt) - new Date(left.createdAt);
      }),
    [messages]
  );

  const activeMessage = useMemo(
    () => sortedMessages.find((message) => message._id === activeMessageId) || null,
    [activeMessageId, sortedMessages]
  );

  const markAsRead = async (messageId) => {
    if (!messageId) return;

    try {
      await axios.patch(`/api/contact/messages/${messageId}/read`, {}, { withCredentials: true });

      setMessages((current) =>
        current.map((message) =>
          message._id === messageId ? { ...message, read: true } : message
        )
      );
    } catch (requestError) {
      console.error('Unable to mark message as read.', requestError);
    }
  };

  useEffect(() => {
    if (activeMessage && !activeMessage.read) {
      markAsRead(activeMessage._id);
    }
  }, [activeMessage]);

  return (
    <AdminPageShell
      title="Inbox"
      description="Review patient inquiries from the clinic contact form."
      icon={Mail}
      backTo="/admin/dashboard"
      backLabel="Dashboard"
      maxWidth="max-w-7xl"
    >
      {error ? (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-900 p-2 text-white">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Admin inbox
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Patient messages</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name/email/message"
              className="w-60 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center p-8 text-sm text-slate-500">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 bg-slate-50/70 p-8 text-center text-slate-500">
            <MessageSquare className="h-10 w-10 text-slate-400" />
            <p className="text-lg font-semibold text-slate-900">No messages yet</p>
            <p className="max-w-md text-sm">
              New contact requests from the website will appear here as soon as they arrive.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[560px] flex-col lg:flex-row">
            {!activeMessage ? (
              <div className="w-full border-b border-slate-200 bg-white lg:w-[360px] lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {messages.length} message{messages.length === 1 ? '' : 's'}
                </div>

                <div className="max-h-[480px] overflow-y-auto">
                  {sortedMessages
                  .filter((message) => {
                    const q = query.trim().toLowerCase();
                    if (!q) return true;
                    const haystack = `${message.name || ''} ${message.email || ''} ${message.message || ''}`.toLowerCase();
                    return haystack.includes(q);
                  })
                  .map((message) => {
                    const meta = formatMessageMeta(message.createdAt);

                    return (
                      <button
                        key={message._id}
                        type="button"
                        onClick={() => setActiveMessageId(message._id)}
                        className="flex w-full border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                            {message.name?.charAt(0)?.toUpperCase() || 'M'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`truncate text-sm ${message.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                                {message.name}
                              </p>
                              <span className="shrink-0 text-[11px] text-slate-500">{meta}</span>
                            </div>
                            <p className="mt-1 truncate text-sm text-slate-500">
                              {message.email}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className={`flex-1 bg-slate-50 ${activeMessage ? 'block' : 'hidden lg:block'}`}>
              {activeMessage ? (
                <div className="flex h-full flex-col">
                  <div className="border-b border-slate-200 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setActiveMessageId('')}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                            From
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-slate-900">{activeMessage.name}</h3>
                          <p className="text-sm text-slate-500">{activeMessage.email}</p>
                        </div>
                        <div className="text-sm text-slate-500">
                          {new Date(activeMessage.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
                        {activeMessage.message}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hidden h-full items-center justify-center p-8 text-sm text-slate-500 lg:flex">
                  Select a sender to read the message.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}

export default Inbox;
