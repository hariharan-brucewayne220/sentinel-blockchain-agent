export default function Dashboard() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Sentinel Dashboard</h1>
      <p className="text-gray-500 mt-2">Portfolio overview — coming in Phase 6.</p>
      <nav className="mt-6 flex gap-4 text-sm">
        <a href="/feed" className="text-blue-600 hover:underline">Action Feed</a>
        <a href="/configure" className="text-blue-600 hover:underline">Configure Policy</a>
        <a href="/fund" className="text-blue-600 hover:underline">Fund Account</a>
      </nav>
    </main>
  )
}
