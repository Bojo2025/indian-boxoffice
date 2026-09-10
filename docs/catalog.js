window.IBO_CATALOG = {
  "generatedAt": "2026-09-10T20:37:22.485Z",
  "deskDate": "2026-09-11",
  "comparedTo": "2026-09-10",
  "mode": "server-consensus",
  "spine": [
    "sacnilk",
    "koimoi",
    "hungama",
    "boi"
  ],
  "health": {
    "hardFail": false,
    "alerts": [
      "koimoi failed: HTTP 403 (streak 13)",
      "koimoi has failed 13 consecutive publishes",
      "boi failed: HTTP 403 (streak 11)",
      "boi has failed 11 consecutive publishes"
    ],
    "spine": {
      "sacnilk": {
        "ok": true,
        "streakFail": 0,
        "detail": "719 collection rows from 16 live pulls"
      },
      "koimoi": {
        "ok": false,
        "streakFail": 13,
        "detail": "HTTP 403"
      },
      "hungama": {
        "ok": true,
        "streakFail": 0,
        "detail": "46 collection rows from 16 live pulls"
      },
      "boi": {
        "ok": false,
        "streakFail": 11,
        "detail": "HTTP 403"
      }
    }
  },
  "sources": [
    {
      "id": "sacnilk",
      "name": "Sacnilk",
      "homepage": "https://www.sacnilk.com/box-office-collections",
      "kind": "trade",
      "weight": 1,
      "notes": "Daily all-India tracker. Primary live reference for net collections and shows."
    },
    {
      "id": "koimoi",
      "name": "Koimoi",
      "homepage": "https://www.koimoi.com/box-office/",
      "kind": "trade",
      "weight": 0.92,
      "notes": "Trade desk with day-wise India net, gross and worldwide."
    },
    {
      "id": "hungama",
      "name": "Bollywood Hungama",
      "homepage": "https://www.bollywoodhungama.com/box-office-collections/",
      "kind": "trade",
      "weight": 0.88,
      "notes": "Long-running Hindi trade tables. Often narrower (Hindi-weighted) than pan-India trackers."
    },
    {
      "id": "boi",
      "name": "Box Office India",
      "homepage": "https://www.boxofficeindia.com/",
      "kind": "trade",
      "weight": 0.9,
      "notes": "Classic trade weekly. Slower, conservative nett. Does not cover all South films equally."
    },
    {
      "id": "pinkvilla",
      "name": "Pinkvilla",
      "homepage": "https://www.pinkvilla.com/entertainment/box-office",
      "kind": "newsroom",
      "weight": 0.7,
      "notes": "Newsroom estimates, usually India gross, citing trade."
    },
    {
      "id": "express",
      "name": "Indian Express",
      "homepage": "https://indianexpress.com/section/entertainment/bollywood/box-office-collection/",
      "kind": "newsroom",
      "weight": 0.68,
      "notes": "Reported figures attributed to Sacnilk and other trackers."
    },
    {
      "id": "etimes",
      "name": "ETimes",
      "homepage": "https://timesofindia.indiatimes.com/entertainment",
      "kind": "newsroom",
      "weight": 0.65,
      "notes": "Times of India entertainment desk, language-wise splits on big openings."
    },
    {
      "id": "wikipedia",
      "name": "Wikipedia compiled",
      "homepage": "https://en.wikipedia.org/wiki/List_of_Indian_films_of_2026",
      "kind": "compiler",
      "weight": 0.45,
      "notes": "Secondary compilation of published worldwide grosses. Lags live trade."
    },
    {
      "id": "producer",
      "name": "Producer statement",
      "homepage": "",
      "kind": "compiler",
      "weight": 0.35,
      "notes": "Studio / producer claimed gross. Logged for spread, never used as sole consensus. No canonical URL."
    }
  ],
  "films": [
    {
      "id": "toxic",
      "slug": "toxic",
      "title": "Toxic",
      "language": "Kannada",
      "industry": "Sandalwood / Pan-India",
      "director": "Geetu Mohandas",
      "starring": "Yash, Kiara Advani, Nayanthara, Huma Qureshi, Tara Sutaria, Rukmini Vasanth",
      "releaseDate": "2026-08-26",
      "budgetCr": 500,
      "synopsis": "A pan-India drama set in post-independence Goa. Dual-role Yash vehicle that opened like a mass film and is holding like a divided one.",
      "status": "playing",
      "verdict": "Pending",
      "posterKey": "toxic",
      "poster": "./posters/toxic.jpg",
      "indiaNet": 248.24,
      "indiaGross": 296.29,
      "overseas": 43.5,
      "worldwide": 339.32,
      "lastDayNet": 0.39,
      "trackedThroughDay": 17,
      "liveSources": [
        "sacnilk",
        "wikipedia"
      ],
      "deltaNet": 0.39,
      "deltaWw": 0
    },
    {
      "id": "awarapan-2",
      "slug": "awarapan-2",
      "title": "Awarapan 2",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Nitin Kakkar",
      "starring": "Emraan Hashmi",
      "releaseDate": "2026-08-14",
      "budgetCr": 45,
      "synopsis": "Vishesh Films sequel. Quiet Independence-weekend build, then a genuine word-of-mouth climb into the 100-crore club.",
      "status": "playing",
      "verdict": "Hit",
      "posterKey": "awarapan-2",
      "poster": "./posters/awarapan-2.jpg",
      "indiaNet": 150.43,
      "indiaGross": 179.31,
      "overseas": 33.41,
      "worldwide": 210.26,
      "lastDayNet": 0.03,
      "trackedThroughDay": 29,
      "liveSources": [
        "sacnilk",
        "hungama"
      ],
      "deltaNet": 0.03,
      "deltaWw": 0
    },
    {
      "id": "vishwanath-and-sons",
      "slug": "vishwanath-and-sons",
      "title": "Vishwanath And Sons",
      "language": "Tamil",
      "industry": "Kollywood",
      "director": "Nandha Periyasamy",
      "starring": "Suriya, Mamitha Baiju",
      "releaseDate": "2026-08-14",
      "budgetCr": 80,
      "synopsis": "Suriya family drama with a slow theatrical burn. Producer gross and Sacnilk remain tens of crores apart — the year's clearest reporting gap.",
      "status": "playing",
      "verdict": "Hit",
      "posterKey": "vishwanath",
      "poster": "./posters/vishwanath.jpg",
      "indiaNet": 122.02,
      "indiaGross": 141.12,
      "overseas": 67.75,
      "worldwide": 208.87,
      "lastDayNet": 0.07,
      "trackedThroughDay": 28,
      "liveSources": [
        "sacnilk"
      ],
      "deltaNet": 0.07,
      "deltaWw": 2.82
    },
    {
      "id": "irumudi",
      "slug": "irumudi",
      "title": "Irumudi",
      "language": "Telugu",
      "industry": "Tollywood",
      "director": "Shiva Nirvana",
      "starring": "Ravi Teja, Baby Nakshathra",
      "releaseDate": "2026-08-21",
      "budgetCr": 60,
      "synopsis": "Ayyappa Deeksha road film that turned into Ravi Teja's cleanest family hold of the decade, led by Nizam.",
      "status": "playing",
      "verdict": "Super Hit",
      "posterKey": "irumudi",
      "poster": "./posters/irumudi.jpg",
      "indiaNet": 174.45,
      "indiaGross": 202.7,
      "overseas": 22.25,
      "worldwide": 224.95,
      "lastDayNet": 1.6,
      "trackedThroughDay": 21,
      "liveSources": [
        "sacnilk"
      ],
      "deltaNet": 1.6,
      "deltaWw": 1.85
    },
    {
      "id": "batwara-1947",
      "slug": "batwara-1947",
      "title": "Batwara 1947",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Anil Sharma",
      "starring": "Gippy Grewal, Mahie Gill",
      "releaseDate": "2026-08-14",
      "budgetCr": 40,
      "synopsis": "Partition drama that found a North circuit but not a national breakout.",
      "status": "playing",
      "verdict": "Average",
      "posterKey": "batwara",
      "poster": "./posters/batwara.jpg",
      "indiaNet": 38.08,
      "indiaGross": 45.16,
      "overseas": 9.05,
      "worldwide": 54.2,
      "lastDayNet": 0.01,
      "trackedThroughDay": 29,
      "liveSources": [
        "sacnilk",
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "hi",
      "slug": "hi",
      "title": "Hi",
      "language": "Tamil",
      "industry": "Kollywood",
      "director": "Gokul",
      "starring": "Nayanthara, Kavin",
      "releaseDate": "2026-08-28",
      "budgetCr": 25,
      "synopsis": "Small-to-mid Tamil release climbing on Sunday occupancy rather than a Friday blast.",
      "status": "playing",
      "verdict": "Pending",
      "posterKey": "hi",
      "poster": "./posters/hi.jpg",
      "indiaNet": 12.39,
      "indiaGross": 14.42,
      "overseas": 0,
      "worldwide": 14.42,
      "lastDayNet": 0.05,
      "trackedThroughDay": 14,
      "liveSources": [
        "sacnilk"
      ],
      "deltaNet": 0.05,
      "deltaWw": 0.06
    },
    {
      "id": "insidious-further",
      "slug": "insidious-out-of-the-further",
      "title": "Insidious: Out of The Further",
      "language": "English",
      "industry": "Hollywood",
      "director": "Patrick Wilson",
      "starring": "Ty Simpkins, Patrick Wilson",
      "releaseDate": "2026-08-21",
      "budgetCr": null,
      "synopsis": "Horror holdover with a serviceable multiplex opening and a fast weekday fade.",
      "status": "playing",
      "verdict": "Pending",
      "posterKey": "insidious-further",
      "poster": "./posters/insidious-further.jpg",
      "indiaNet": 16.62,
      "indiaGross": 19.61,
      "overseas": 2,
      "worldwide": 21.61,
      "lastDayNet": 0.18,
      "trackedThroughDay": 11,
      "liveSources": [],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "paw-patrol-dino",
      "slug": "paw-patrol-the-dino-movie",
      "title": "PAW Patrol: The Dino Movie",
      "language": "English",
      "industry": "Hollywood",
      "director": "Cal Brunker",
      "starring": "Animated",
      "releaseDate": "2026-08-21",
      "budgetCr": null,
      "synopsis": "Kids' matinee title. Modest India gross, weekend-weighted.",
      "status": "playing",
      "verdict": "Pending",
      "posterKey": "paw-patrol-dino",
      "poster": "./posters/paw-patrol-dino.jpg",
      "indiaNet": 3.44,
      "indiaGross": 4.06,
      "overseas": 0.42,
      "worldwide": 4.48,
      "lastDayNet": 0.08,
      "trackedThroughDay": 11,
      "liveSources": [],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "hanuman-ansh",
      "slug": "hanuman-ansh",
      "title": "Hanuman Ansh",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Charuvi Agrawal",
      "starring": "Animated",
      "releaseDate": "2026-08-07",
      "budgetCr": 30,
      "synopsis": "Devotional animation with a long thin tail rather than an opening.",
      "status": "late",
      "verdict": "Flop",
      "posterKey": "hanuman-ansh",
      "poster": "./posters/hanuman-ansh.jpg",
      "indiaNet": 163.13,
      "indiaGross": 192.79,
      "overseas": 0,
      "worldwide": 192.75,
      "lastDayNet": 10,
      "trackedThroughDay": 35,
      "liveSources": [
        "sacnilk",
        "hungama"
      ],
      "deltaNet": 10,
      "deltaWw": 11.8
    },
    {
      "id": "spider-man-bnd",
      "slug": "spider-man-brand-new-day",
      "title": "Spider-Man: Brand New Day",
      "language": "English",
      "industry": "Hollywood",
      "director": "Destin Daniel Cretton",
      "starring": "Tom Holland",
      "releaseDate": "2026-07-30",
      "budgetCr": null,
      "synopsis": "The year's biggest Hollywood grosser in India. Still occupying premium screens in week five.",
      "status": "late",
      "verdict": "All Time Blockbuster",
      "posterKey": "spider-man-bnd",
      "poster": "./posters/spider-man-bnd.jpg",
      "indiaNet": 498.12,
      "indiaGross": 595.95,
      "overseas": 0,
      "worldwide": 595.95,
      "lastDayNet": 0.19,
      "trackedThroughDay": 43,
      "liveSources": [
        "sacnilk"
      ],
      "deltaNet": 0.19,
      "deltaWw": 0.21
    },
    {
      "id": "dhamaal-4",
      "slug": "dhamaal-4",
      "title": "Dhamaal 4",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Kapil Sharma",
      "starring": "Arshad Warsi, Javed Jaffrey, Riteish Deshmukh",
      "releaseDate": "2026-07-10",
      "budgetCr": 80,
      "synopsis": "Comedy franchise that paid for itself without becoming a cultural event.",
      "status": "late",
      "verdict": "Hit",
      "posterKey": "dhamaal-4",
      "poster": "./posters/dhamaal-4.jpg",
      "indiaNet": 167.88,
      "indiaGross": 199.36,
      "overseas": 30.85,
      "worldwide": 230.17,
      "lastDayNet": 0.01,
      "trackedThroughDay": 64,
      "liveSources": [
        "sacnilk",
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "the-odyssey",
      "slug": "the-odyssey",
      "title": "The Odyssey",
      "language": "English",
      "industry": "Hollywood",
      "director": "Christopher Nolan",
      "starring": "Matt Damon, Tom Holland, Anne Hathaway",
      "releaseDate": "2026-07-17",
      "budgetCr": null,
      "synopsis": "Prestige Hollywood hold. India is a premium-screen story, not a mass one.",
      "status": "late",
      "verdict": "Pending",
      "posterKey": "the-odyssey",
      "poster": "./posters/the-odyssey.jpg",
      "indiaNet": 193.85,
      "indiaGross": 230.8,
      "overseas": 0,
      "worldwide": 230.8,
      "lastDayNet": 0.16,
      "trackedThroughDay": 56,
      "liveSources": [
        "sacnilk"
      ],
      "deltaNet": 0.16,
      "deltaWw": 0.18
    },
    {
      "id": "dhurandhar",
      "slug": "dhurandhar-the-revenge",
      "title": "Dhurandhar: The Revenge",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Aditya Dhar",
      "starring": "Ranveer Singh, Akshaye Khanna, R. Madhavan, Sanjay Dutt",
      "releaseDate": "2026-03-19",
      "budgetCr": 250,
      "synopsis": "The film that bent 2026. Roughly a fifth of India's first-half box office sat in this one title.",
      "status": "closed",
      "verdict": "All Time Blockbuster",
      "posterKey": "dhurandhar",
      "poster": "./posters/dhurandhar.jpg",
      "indiaNet": 1108.09,
      "indiaGross": 1375.39,
      "overseas": 470,
      "worldwide": 1820,
      "lastDayNet": 0.01,
      "trackedThroughDay": 177,
      "liveSources": [
        "sacnilk",
        "hungama",
        "wikipedia"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "border-2",
      "slug": "border-2",
      "title": "Border 2",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Anoop Sathyan",
      "starring": "Sunny Deol, Varun Dhawan, Diljit Dosanjh, Ahan Shetty",
      "releaseDate": "2026-01-23",
      "budgetCr": 150,
      "synopsis": "Republic Day war film. Second-highest Indian grosser of the year, a long way behind Dhurandhar.",
      "status": "closed",
      "verdict": "Blockbuster",
      "posterKey": "border-2",
      "poster": "./posters/border-2.jpg",
      "indiaNet": 329.43,
      "indiaGross": 393.46,
      "overseas": 57.25,
      "worldwide": 450.19,
      "lastDayNet": 0.01,
      "trackedThroughDay": 232,
      "liveSources": [
        "sacnilk",
        "hungama",
        "wikipedia"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "peddi",
      "slug": "peddi",
      "title": "Peddi",
      "language": "Telugu",
      "industry": "Tollywood",
      "director": "Buchireddy Mallidi",
      "starring": "Ram Charan, Janhvi Kapoor",
      "releaseDate": "2026-03-27",
      "budgetCr": 200,
      "synopsis": "Sports drama whose worldwide gross is still published as a range — ₹330 to ₹400 crore.",
      "status": "closed",
      "verdict": "Blockbuster",
      "posterKey": "peddi",
      "poster": "./posters/peddi.jpg",
      "indiaNet": 244.64,
      "indiaGross": 289,
      "overseas": 52.9,
      "worldwide": 341.9,
      "lastDayNet": 0.01,
      "trackedThroughDay": 169,
      "liveSources": [
        "sacnilk",
        "wikipedia",
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "jana-nayagan",
      "slug": "jana-nayagan",
      "title": "Jana Nayagan",
      "language": "Tamil",
      "industry": "Kollywood",
      "director": "H. Vinoth",
      "starring": "Vijay",
      "releaseDate": "2026-01-10",
      "budgetCr": 250,
      "synopsis": "Vijay's theatrical farewell. Tight 320–325 crore band across newsrooms, now on ZEE5.",
      "status": "closed",
      "verdict": "Blockbuster",
      "posterKey": "jana-nayagan",
      "poster": "./posters/jana-nayagan.jpg",
      "indiaNet": 0,
      "indiaGross": 0,
      "overseas": 0,
      "worldwide": 322.5,
      "lastDayNet": null,
      "trackedThroughDay": 245,
      "liveSources": [
        "wikipedia"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "karuppu",
      "slug": "karuppu",
      "title": "Karuppu",
      "language": "Tamil",
      "industry": "Kollywood",
      "director": "R. Ajay Gnanamuthu",
      "starring": "Suriya",
      "releaseDate": "2026-04-10",
      "budgetCr": 120,
      "synopsis": "Suriya's mass register. Paired with Vishwanath And Sons, his most complete year.",
      "status": "closed",
      "verdict": "Blockbuster",
      "posterKey": "karuppu",
      "poster": "./posters/karuppu.jpg",
      "indiaNet": 198.18,
      "indiaGross": 228.97,
      "overseas": 81.15,
      "worldwide": 310.12,
      "lastDayNet": 0.01,
      "trackedThroughDay": 155,
      "liveSources": [
        "sacnilk",
        "wikipedia"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "msvpg",
      "slug": "mana-shankara-vara-prasad-garu",
      "title": "Mana Shankara Vara Prasad Garu",
      "language": "Telugu",
      "industry": "Tollywood",
      "director": "Anil Ravipudi",
      "starring": "Chiranjeevi",
      "releaseDate": "2026-01-12",
      "budgetCr": 150,
      "synopsis": "Sankranti Megastar film. Solid 300-crore worldwide without dominating the year.",
      "status": "closed",
      "verdict": "Hit",
      "posterKey": "msvpg",
      "poster": "./posters/msvpg.svg",
      "indiaNet": 0,
      "indiaGross": 0,
      "overseas": 0,
      "worldwide": 305,
      "lastDayNet": null,
      "trackedThroughDay": 243,
      "liveSources": [
        "wikipedia"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "bhooth-bangla",
      "slug": "bhooth-bangla",
      "title": "Bhooth Bangla",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Priyadarshan",
      "starring": "Akshay Kumar, Taapsee Pannu",
      "releaseDate": "2026-04-03",
      "budgetCr": 130,
      "synopsis": "Comedy-horror that landed as a paid-up performer rather than a runaway.",
      "status": "closed",
      "verdict": "Average",
      "posterKey": "bhooth-bangla",
      "poster": "./posters/bhooth-bangla.jpg",
      "indiaNet": 168.26,
      "indiaGross": 199.13,
      "overseas": 48.15,
      "worldwide": 247.28,
      "lastDayNet": 5,
      "trackedThroughDay": 162,
      "liveSources": [
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "drishyam-3",
      "slug": "drishyam-3",
      "title": "Drishyam 3",
      "language": "Malayalam",
      "industry": "Mollywood",
      "director": "Jeethu Joseph",
      "starring": "Mohanlal",
      "releaseDate": "2026-02-19",
      "budgetCr": 70,
      "synopsis": "The franchise still prints money in Malayalam and dubbed Hindi without needing a splash opening.",
      "status": "closed",
      "verdict": "Blockbuster",
      "posterKey": "drishyam-3",
      "poster": "./posters/drishyam-3.jpg",
      "indiaNet": 0,
      "indiaGross": 0,
      "overseas": 0,
      "worldwide": 242,
      "lastDayNet": null,
      "trackedThroughDay": 205,
      "liveSources": [
        "wikipedia"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "vaazha-ii",
      "slug": "vaazha-ii",
      "title": "Vaazha II: Biopic of a Billion Bros",
      "language": "Malayalam",
      "industry": "Mollywood",
      "director": "Kannan Thamarakkulam",
      "starring": "Basil Joseph",
      "releaseDate": "2026-03-06",
      "budgetCr": 20,
      "synopsis": "Sequel that out-earned its scale. A Mollywood word-of-mouth case study.",
      "status": "closed",
      "verdict": "Blockbuster",
      "posterKey": "vaazha-ii",
      "poster": "./posters/vaazha-ii.svg",
      "indiaNet": 178,
      "indiaGross": 210,
      "overseas": 24.5,
      "worldwide": 234.5,
      "lastDayNet": null,
      "trackedThroughDay": 80,
      "liveSources": [],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "welcome-jungle",
      "slug": "welcome-to-the-jungle",
      "title": "Welcome To The Jungle",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Ahmed Khan",
      "starring": "Akshay Kumar, Disha Patani",
      "releaseDate": "2026-06-26",
      "budgetCr": 100,
      "synopsis": "Early-summer comedy that held a multiplex floor into July.",
      "status": "closed",
      "verdict": "Hit",
      "posterKey": "welcome-jungle",
      "poster": "./posters/welcome-jungle.jpg",
      "indiaNet": 134.11,
      "indiaGross": 159.15,
      "overseas": 33.6,
      "worldwide": 192.75,
      "lastDayNet": 0.01,
      "trackedThroughDay": 78,
      "liveSources": [
        "sacnilk",
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "cocktail-2",
      "slug": "cocktail-2",
      "title": "Cocktail 2",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Homi Adajania",
      "starring": "Saif Ali Khan, Deepika Padukone, Diana Penty",
      "releaseDate": "2026-06-19",
      "budgetCr": 90,
      "synopsis": "Nostalgia sequel. Average verdict, adult multiplex.",
      "status": "closed",
      "verdict": "Average",
      "posterKey": "cocktail-2",
      "poster": "./posters/cocktail-2.jpg",
      "indiaNet": 95.5,
      "indiaGross": 113.74,
      "overseas": 34,
      "worldwide": 147.73,
      "lastDayNet": 0.01,
      "trackedThroughDay": 85,
      "liveSources": [
        "sacnilk",
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    },
    {
      "id": "alpha",
      "slug": "alpha",
      "title": "Alpha",
      "language": "Hindi",
      "industry": "Bollywood",
      "director": "Shiv Rawail",
      "starring": "Alia Bhatt, Sharvari",
      "releaseDate": "2026-07-03",
      "budgetCr": 140,
      "synopsis": "YRF spy-verse entry that opened and then fell off a cliff.",
      "status": "closed",
      "verdict": "Flop",
      "posterKey": "alpha",
      "poster": "./posters/alpha.jpg",
      "indiaNet": 57.72,
      "indiaGross": 68.72,
      "overseas": 29.9,
      "worldwide": 98.62,
      "lastDayNet": null,
      "trackedThroughDay": 71,
      "liveSources": [
        "hungama"
      ],
      "deltaNet": 0,
      "deltaWw": 0
    }
  ],
  "changes": [
    {
      "id": "hanuman-ansh",
      "title": "Hanuman Ansh",
      "text": "Hanuman Ansh: WW +₹11.8 Cr, India net +₹10 Cr since 2026-09-10",
      "deltaNet": 10,
      "deltaWw": 11.8
    },
    {
      "id": "vishwanath-and-sons",
      "title": "Vishwanath And Sons",
      "text": "Vishwanath And Sons: WW +₹2.82 Cr since 2026-09-10",
      "deltaNet": 0.07,
      "deltaWw": 2.82
    },
    {
      "id": "irumudi",
      "title": "Irumudi",
      "text": "Irumudi: WW +₹1.85 Cr, India net +₹1.6 Cr since 2026-09-10",
      "deltaNet": 1.6,
      "deltaWw": 1.85
    }
  ],
  "logs": [
    {
      "sourceId": "sacnilk",
      "status": "ok",
      "detail": "719 collection rows from 16 live pulls"
    },
    {
      "sourceId": "hungama",
      "status": "ok",
      "detail": "46 collection rows from 16 live pulls"
    },
    {
      "sourceId": "wikipedia",
      "status": "ok",
      "detail": "8 collection rows from 1 live pull"
    },
    {
      "sourceId": "pinkvilla",
      "status": "ok",
      "detail": "Fetched 1 page (headlines / status)"
    },
    {
      "sourceId": "koimoi",
      "status": "blocked",
      "detail": "HTTP 403"
    },
    {
      "sourceId": "express",
      "status": "ok",
      "detail": "Fetched 1 page (headlines / status)"
    },
    {
      "sourceId": "boi",
      "status": "blocked",
      "detail": "HTTP 403"
    },
    {
      "sourceId": "etimes",
      "status": "ok",
      "detail": "Fetched 1 page (headlines / status)"
    }
  ],
  "headlines": [
    {
      "sourceId": "sacnilk",
      "title": "Irumudi: Sacnilk 21 days, India net ₹174.45 Cr",
      "url": "https://www.sacnilk.com/news/irumudi_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:16.462Z",
      "summary": "Live day-wise pull. Last day 21. WW ₹224.95 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Toxic: Sacnilk 16 days, India net ₹248.24 Cr",
      "url": "https://www.sacnilk.com/news/toxic_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:16.575Z",
      "summary": "Live day-wise pull. Last day 16. WW ₹339.32 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Awarapan 2: Sacnilk 28 days, India net ₹150.43 Cr",
      "url": "https://www.sacnilk.com/news/awarapan_2_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.009Z",
      "summary": "Live day-wise pull. Last day 28. WW ₹212.85 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Vishwanath And Sons: Sacnilk 28 days, India net ₹122.02 Cr",
      "url": "https://www.sacnilk.com/news/vishwanath_and_sons_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.122Z",
      "summary": "Live day-wise pull. Last day 28. WW ₹208.87 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Batwara 1947: Sacnilk 24 days, India net ₹38.08 Cr",
      "url": "https://www.sacnilk.com/news/batwara_1947_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.144Z",
      "summary": "Live day-wise pull. Last day 24. WW ₹54.2 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Dhurandhar: The Revenge: Sacnilk 98 days, India net ₹1149.3 Cr",
      "url": "https://www.sacnilk.com/news/dhurandhar_2_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.189Z",
      "summary": "Live day-wise pull. Last day 101. WW ₹1813.39 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Hi: Sacnilk 14 days, India net ₹12.39 Cr",
      "url": "https://www.sacnilk.com/news/hi_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.323Z",
      "summary": "Live day-wise pull. Last day 14. WW ₹14.42 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Peddi: Sacnilk 63 days, India net ₹244.64 Cr",
      "url": "https://www.sacnilk.com/news/peddi_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.374Z",
      "summary": "Live day-wise pull. Last day 71. WW ₹341.9 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Border 2: Sacnilk 56 days, India net ₹329.43 Cr",
      "url": "https://www.sacnilk.com/news/border_2_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.489Z",
      "summary": "Live day-wise pull. Last day 58. WW ₹450.19 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Spider-Man: Brand New Day: Sacnilk 43 days, India net ₹498.12 Cr",
      "url": "https://www.sacnilk.com/news/spider_man_brand_new_day_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.726Z",
      "summary": "Live day-wise pull. Last day 43. WW ₹595.95 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Dhamaal 4: Sacnilk 58 days, India net ₹167.88 Cr",
      "url": "https://www.sacnilk.com/news/dhamaal_4_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.830Z",
      "summary": "Live day-wise pull. Last day 61. WW ₹230.17 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Karuppu: Sacnilk 55 days, India net ₹198.18 Cr",
      "url": "https://www.sacnilk.com/news/karuppu_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.926Z",
      "summary": "Live day-wise pull. Last day 59. WW ₹310.12 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Hanuman Ansh: Sacnilk 35 days, India net ₹163.13 Cr",
      "url": "https://www.sacnilk.com/news/hanuman_ansh_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:17.948Z",
      "summary": "Live day-wise pull. Last day 35. WW ₹192.75 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Cocktail 2: Sacnilk 59 days, India net ₹95.5 Cr",
      "url": "https://www.sacnilk.com/news/cocktail_2_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:18.027Z",
      "summary": "Live day-wise pull. Last day 66. WW ₹147.73 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "Welcome To The Jungle: Sacnilk 49 days, India net ₹134.11 Cr",
      "url": "https://www.sacnilk.com/news/welcome_to_the_jungle_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:18.114Z",
      "summary": "Live day-wise pull. Last day 49. WW ₹192.75 Cr."
    },
    {
      "sourceId": "sacnilk",
      "title": "The Odyssey: Sacnilk 56 days, India net ₹193.85 Cr",
      "url": "https://www.sacnilk.com/news/the_odyssey_2026_Box_Office_Collection_Day_Wise_Worldwide",
      "publishedAt": "2026-09-10T20:37:18.532Z",
      "summary": "Live day-wise pull. Last day 56. WW ₹230.8 Cr."
    }
  ],
  "morningBrief": {
    "briefDate": "2026-09-10",
    "generatedAt": "2026-09-10T05:15:41.284Z",
    "headline": "Dhurandhar: The Revenge leads the board at ₹1,820 Cr WW",
    "lede": "Dhurandhar: The Revenge sits at ₹1,820 Cr worldwide / ₹1,108.1 Cr India nett on the consensus desk.",
    "body": "No material day-over-day moves since the last board snapshot.\n\nNow playing: Toxic (₹339.3 Cr WW); Awarapan 2 (₹210.3 Cr WW); Vishwanath And Sons (₹206.1 Cr WW); Irumudi (₹223.1 Cr WW); Batwara 1947 (₹54.2 Cr WW).\n\nWire: Batwara 1947: Sacnilk 24 days, India net ₹38.08 Cr (sacnilk).\n\nFigures are weighted-median consensus across trade trackers. India has no official auditor.",
    "citations": [
      {
        "url": "https://www.sacnilk.com/news/batwara_1947_2026_Box_Office_Collection_Day_Wise_Worldwide",
        "title": "Batwara 1947: Sacnilk 24 days, India net ₹38.08 Cr"
      },
      {
        "url": "https://www.sacnilk.com/news/irumudi_2026_Box_Office_Collection_Day_Wise_Worldwide",
        "title": "Irumudi: Sacnilk 20 days, India net ₹172.85 Cr"
      },
      {
        "url": "https://www.sacnilk.com/news/awarapan_2_2026_Box_Office_Collection_Day_Wise_Worldwide",
        "title": "Awarapan 2: Sacnilk 27 days, India net ₹150.4 Cr"
      },
      {
        "url": "https://www.sacnilk.com/news/hi_2026_Box_Office_Collection_Day_Wise_Worldwide",
        "title": "Hi: Sacnilk 13 days, India net ₹12.34 Cr"
      },
      {
        "url": "https://www.sacnilk.com/news/vishwanath_and_sons_2026_Box_Office_Collection_Day_Wise_Worldwide",
        "title": "Vishwanath And Sons: Sacnilk 27 days, India net ₹121.95 Cr"
      }
    ],
    "boardGeneratedAt": "2026-09-10T05:15:32.344Z",
    "model": "board-template"
  },
  "downloads": {
    "boardJson": "./board.json",
    "healthJson": "./health.json",
    "history": "./history/2026-09-11.json"
  }
};
