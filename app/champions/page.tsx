'use client';

import 'react-responsive-carousel/lib/styles/carousel.min.css';
import React from 'react';
import { Carousel } from 'react-responsive-carousel';
import Image from 'next/image';

const champions = [
	{ year: 2017, team: 'Mike Garibay | The Choy Bois', img: '/images/champions/2017.jpg' },
	{ year: 2018, team: 'Johnathan David | End My Suffering!', img: '/images/champions/2018.jpg' },
	{ year: 2019, team: 'Brent Porotsky | Sandusky Tight Ends', img: '/images/champions/2019.jpg' },
	{ year: 2020, team: 'Mike Garibay | Tossin’ Heat', img: '/images/champions/2020.jpg' },
	{ year: 2021, team: 'Mike Garibay | Tossin’ Heat', img: '/images/champions/2021.jpg' },
	{ year: 2022, team: 'Jordan Bresnen | Rebuild Year ⏳😈', img: '/images/champions/2022.jpg' },
	{ year: 2023, team: `Hunter Boothe | Let's Get *Redacted* in Here`, img: '/images/champions/2023.jpg' },
	{ year: 2024, team: 'Brent Porotsky | Bottom of the Pool', img: '/images/champions/2024.jpg' },
];

export default function ChampionsPage() {
	return (
		<div className="min-h-screen py-12 px-6 bg-[#181818]">
			<h1 className="text-4xl font-extrabold text-emerald-200 text-center mb-10 drop-shadow">
				🏆 Bok Choy League Champions
			</h1>

			<div className="w-full max-w-xl mx-auto">
				<Carousel
					showThumbs={false}
					showStatus={false}
					infiniteLoop
					useKeyboardArrows
					autoPlay
					interval={5000}
					dynamicHeight={false}
					renderArrowPrev={(onClickHandler, hasPrev, label) =>
						hasPrev && (
							<button
								type="button"
								onClick={onClickHandler}
								title={label}
								className="absolute left-2 top-1/2 -translate-y-1/2 bg-emerald-900 text-emerald-100 rounded-full p-2 shadow-lg hover:bg-emerald-700 transition z-10"
							>
								‹
							</button>
						)
					}
					renderArrowNext={(onClickHandler, hasNext, label) =>
						hasNext && (
							<button
								type="button"
								onClick={onClickHandler}
								title={label}
								className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-900 text-emerald-100 rounded-full p-2 shadow-lg hover:bg-emerald-700 transition z-10"
							>
								›
							</button>
						)
					}
				>
					{champions.map((champ) => (
						<div key={champ.year} className="relative bg-[#232323] rounded-xl shadow-lg border border-[#333] p-4">
							<Image
								src={champ.img}
								alt={`${champ.year} Champion: ${champ.team}`}
								width={600}
								height={400}
								className="rounded-lg object-cover mx-auto border-4 border-[#181818] shadow"
							/>
							<p className="legend text-lg font-semibold mt-4 text-emerald-100 bg-[#181818] rounded px-4 py-2 text-center shadow">
								{champ.year} –{' '}
								<span className="text-emerald-300">{champ.team}</span>
							</p>
						</div>
					))}
				</Carousel>
			</div>
		</div>
	);
}
