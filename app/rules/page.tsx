import GoogleDocViewer from '@/app/components/googledocviewer';

export default function LeagueRulesPage() {
  return (
    <div className="min-h-screen bg-green-50 py-10 px-6">
      <h1 className="text-3xl font-bold text-center text-green-800 mb-6">📄 League Rules</h1>
      <GoogleDocViewer docId="1gj0O8C0uGSuRfdKOp8DtMYaxPpKued1vfTOysgBe75Q" />
    </div>
  );
}
