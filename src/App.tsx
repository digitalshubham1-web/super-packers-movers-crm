import { Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Activities from './pages/Activities'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/Calendar'
import Calling from './pages/Calling'
import CallCampaigns from './pages/CallCampaigns'
import VoiceAgents from './pages/VoiceAgents'
import EmailPage from './pages/Email'
import Automations from './pages/Automations'
import Quotations from './pages/billing/Quotations'
import Invoices from './pages/billing/Invoices'
import InvoiceEditor from './pages/billing/InvoiceEditor'
import Payments from './pages/billing/Payments'
import Items from './pages/billing/Items'
import Revenue from './pages/billing/Revenue'
import Analytics from './pages/Analytics'
import LeadReports from './pages/LeadReports'
import Leaderboard from './pages/Leaderboard'
import Team from './pages/Team'
import Integrations from './pages/Integrations'
import SettingsPage from './pages/Settings'
import WhatsAppLayout from './pages/whatsapp/WhatsAppLayout'
import Chat from './pages/whatsapp/Chat'
import AiAgentPage from './pages/whatsapp/AiAgent'
import Templates from './pages/whatsapp/Templates'
import BotFlows from './pages/whatsapp/BotFlows'
import Campaigns from './pages/whatsapp/Campaigns'
import WaSettings from './pages/whatsapp/WaSettings'

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold">Page not found</p>
      <Link to="/" className="mt-2 inline-block text-sm text-brand">Back to the dashboard</Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="activities" element={<Activities />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="calling" element={<Calling />} />
        <Route path="call-campaigns" element={<CallCampaigns />} />
        <Route path="voice-agents" element={<VoiceAgents />} />
        <Route path="email" element={<EmailPage />} />
        <Route path="automations" element={<Automations />} />
        <Route path="billing/quotations" element={<Quotations />} />
        <Route path="billing/invoices" element={<Invoices />} />
        <Route path="billing/invoices/new" element={<InvoiceEditor />} />
        <Route path="billing/invoices/:id" element={<InvoiceEditor />} />
        <Route path="billing/payments" element={<Payments />} />
        <Route path="billing/items" element={<Items />} />
        <Route path="billing/revenue" element={<Revenue />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports/leads" element={<LeadReports />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="team" element={<Team />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="whatsapp" element={<WhatsAppLayout />}>
          <Route index element={<Chat />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ai-agent" element={<AiAgentPage />} />
          <Route path="templates" element={<Templates />} />
          <Route path="flows" element={<BotFlows />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="settings" element={<WaSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
