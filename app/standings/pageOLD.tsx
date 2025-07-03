import teams from '../../public/data/teams/teams.json';

export default function TeamsPage() {
  const champion = teams.find((team) => team.Champion === true);
  const rest = teams.filter((team) => team.Champion !== true);

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-4xl font-extrabold mb-10 text-center text-green-800">
        The Bok Choy League Members
      </h1>

      {/* Champion Card */}
      {champion && (
        <div className="max-w-xl mx-auto mb-12">
          <div className="bg-yellow-100 border-4 border-yellow-400 rounded-2xl shadow-2xl p-8 text-center">
            <h2 className="text-3xl font-extrabold text-yellow-700 mb-2">
              🏆 {champion["Team Name"]}
            </h2>
            <p className="text-md text-gray-700 mb-1">
              Owner: <span className="font-medium">{champion["Team Owner"]}</span>
            </p>
            <p className="text-lg font-bold text-yellow-600">
              Championships: {champion["Championships Won"]}
            </p>
            <p className="text-sm text-yellow-600">
              {champion["Years Won"].join(', ')}
            </p>
            <p className="mt-2 text-sm italic text-gray-600">Reigning Champion</p>
          </div>
        </div>
      )}

      {/* All Other Teams */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {rest.map((team, index) => (
          <div
            key={index}
            className="bg-white border border-green-200 rounded-2xl shadow-md p-6 text-center transition-transform duration-300 hover:scale-105"
          >
            <h2 className="text-2xl font-bold text-green-700 mb-2">
              {team["Team Name"]}
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Owner: <span className="font-medium">{team["Team Owner"]}</span>
            </p>
            <p className="text-md font-semibold text-yellow-600">
              🏆 Championships: {team["Championships Won"]}
            </p>
            <p className="text-sm text-yellow-500">
              {team["Years Won"].join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
