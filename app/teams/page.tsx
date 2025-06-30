// app/teams/page.tsx
export default function TeamsPage() {
  const teams = [
    {
      id: 1,
      name: 'Kale’d It',
      manager: 'Sarah L.',
      bio: 'The reigning champ. Strategic, calm, and ruthless in trades.',
    },
    {
      id: 2,
      name: 'Choyzilla',
      manager: 'Mike T.',
      bio: 'Explosive scorer with an all-or-nothing draft approach.',
    },
    {
      id: 3,
      name: 'Leaf Me Alone',
      manager: 'Jenna R.',
      bio: 'Known for epic comebacks and late-season dominance.',
    },
    {
      id: 4,
      name: 'Bok ‘n’ Roll',
      manager: 'Carlos D.',
      bio: 'The wildcard pick master. Loves sleeper RBs and chaos.',
    },
    {
      id: 5,
      name: 'The Green Machine',
      manager: 'Alex C.',
      bio: 'Plays the waiver wire like a fiddle. Never out of the hunt.',
    },
    {
      id: 6,
      name: 'Sack Choy',
      manager: 'Ricky B.',
      bio: 'Trash talk legend. 0.2pt wins? That’s his specialty.',
    },
    {
      id: 7,
      name: 'Turnip the Heat',
      manager: 'Nia W.',
      bio: 'Drafts bold. Trades bigger. Never afraid to shake things up.',
    },
    {
      id: 8,
      name: 'Brocc the Vote',
      manager: 'Dan E.',
      bio: 'The people\'s manager. Once tied a playoff with a kicker.',
    },
    {
      id: 9,
      name: 'Fantasy Salad',
      manager: 'Olivia P.',
      bio: 'Always balanced. Never flashy. Just consistent domination.',
    },
    {
      id: 10,
      name: 'Team Crunchy',
      manager: 'Josh M.',
      bio: 'Known for heartbreakers, but always fighting to the end.',
    },
  ];

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-4xl font-bold mb-6 text-center">🌿 League Teams</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-green-100 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">{team.name}</h2>
            <p className="text-sm text-gray-600">Manager: {team.manager}</p>
            <p>{team.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
