import { useState, useEffect } from "react";
import {
  Search, Heart, ChevronLeft, ChevronRight,
  Minus, Plus, Maximize2, X, Settings, Home,
  BookOpen, Moon, Sun, Globe,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────

const Y = "#FFFF00";   // Brand yellow
const BK = "#0A0A08";  // Near-black
const WH = "#FFFFFF";  // White
const CR = "#FFFDF0";  // Cream page bg
const BD = "#E8E5D5";  // Border
const T2 = "#6B6857";  // Text secondary
const T3 = "#A8A592";  // Text tertiary

const DP = { fontFamily: "'Playfair Display', serif" } as const;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Screen =
  | "splash" | "home" | "collection" | "reader"
  | "favorites" | "settings" | "projector" | "search";

interface SongSection {
  type: "verse" | "chorus";
  label: string;
  lines: string[];
}

interface Song {
  id: number;
  number: string;
  title: string;
  sections: SongSection[];
}

interface Collection {
  id: string;
  name: string;
  subtitle: string;
  language: string;
  songs: Song[];
}

const favKey = (cid: string, sid: number) => `${cid}::${sid}`;

// ─────────────────────────────────────────────────────────────
// SONG DATA
// ─────────────────────────────────────────────────────────────

const COLLECTIONS: Collection[] = [
  // ── 1. Only Believe ───────────────────────────────────────
  {
    id: "only-believe",
    name: "Only Believe",
    subtitle: "Gospel Songs",
    language: "English",
    songs: [
      {
        id: 1, number: "001", title: "Only Believe",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Fear not, little flock, from the cross to the throne,",
            "From death into life He went for His own;",
            "All power in earth, all power above,",
            "Is given to Him for the flock of His love.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Only believe, only believe,",
            "All things are possible, only believe;",
            "Only believe, only believe,",
            "All things are possible, only believe.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Fear not, little flock, He goeth ahead,",
            "Your Shepherd selecteth the path you must tread;",
            "The waters of Marah He'll sweeten for thee,",
            "He drank all the bitter in Gethsemane.",
          ]},
        ],
      },
      {
        id: 2, number: "002", title: "Blessed Assurance",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Blessed assurance, Jesus is mine!",
            "O what a foretaste of glory divine!",
            "Heir of salvation, purchase of God,",
            "Born of His Spirit, washed in His blood.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "This is my story, this is my song,",
            "Praising my Savior all the day long;",
            "This is my story, this is my song,",
            "Praising my Savior all the day long.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Perfect submission, perfect delight,",
            "Visions of rapture now burst on my sight;",
            "Angels descending, bring from above",
            "Echoes of mercy, whispers of love.",
          ]},
        ],
      },
      {
        id: 3, number: "003", title: "Count Your Blessings",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "When upon life's billows you are tempest-tossed,",
            "When you are discouraged, thinking all is lost,",
            "Count your many blessings, name them one by one,",
            "And it will surprise you what the Lord hath done.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Count your blessings, name them one by one,",
            "Count your blessings, see what God hath done!",
            "Count your blessings, name them one by one,",
            "Count your many blessings, see what God hath done.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Are you ever burdened with a load of care?",
            "Does the cross seem heavy you are called to bear?",
            "Count your many blessings, every doubt will fly,",
            "And you will keep singing as the days go by.",
          ]},
        ],
      },
      {
        id: 4, number: "004", title: "What a Friend We Have in Jesus",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "What a friend we have in Jesus,",
            "All our sins and griefs to bear!",
            "What a privilege to carry",
            "Everything to God in prayer!",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "O what peace we often forfeit,",
            "O what needless pain we bear,",
            "All because we do not carry",
            "Everything to God in prayer!",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Have we trials and temptations?",
            "Is there trouble anywhere?",
            "We should never be discouraged,",
            "Take it to the Lord in prayer.",
          ]},
        ],
      },
      {
        id: 5, number: "005", title: "Amazing Grace",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Amazing grace! How sweet the sound",
            "That saved a wretch like me!",
            "I once was lost, but now am found,",
            "Was blind, but now I see.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "'Twas grace that taught my heart to fear,",
            "And grace my fears relieved;",
            "How precious did that grace appear",
            "The hour I first believed.",
          ]},
          { type: "verse", label: "Verse 3", lines: [
            "Through many dangers, toils and snares,",
            "I have already come;",
            "'Tis grace hath brought me safe thus far,",
            "And grace will lead me home.",
          ]},
        ],
      },
      {
        id: 6, number: "006", title: "How Great Thou Art",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "O Lord my God, when I in awesome wonder,",
            "Consider all the worlds Thy hands have made,",
            "I see the stars, I hear the rolling thunder,",
            "Thy power throughout the universe displayed.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Then sings my soul, my Saviour God, to Thee,",
            "How great Thou art! How great Thou art!",
            "Then sings my soul, my Saviour God, to Thee,",
            "How great Thou art! How great Thou art!",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "And when I think that God, His Son not sparing,",
            "Sent Him to die, I scarce can take it in;",
            "That on the cross, my burden gladly bearing,",
            "He bled and died to take away my sin.",
          ]},
        ],
      },
    ],
  },

  // ── 2. Nyimbo Za Okovu ────────────────────────────────────
  {
    id: "nyimbo-za-okovu",
    name: "Nyimbo Za Okovu",
    subtitle: "Wimbo wa Wokovu",
    language: "Kiswahili",
    songs: [
      {
        id: 1, number: "001", title: "Yesu ni Rafiki Yangu",
        sections: [
          { type: "verse", label: "Mstari 1", lines: [
            "Yesu ni rafiki yangu,",
            "Anipenda, anijua,",
            "Wakati wa shida zangu,",
            "Yeye hunifariji.",
          ]},
          { type: "chorus", label: "Kiitikio", lines: [
            "Rafiki wa kweli, rafiki wa kweli,",
            "Yesu Kristo ni rafiki wa kweli,",
            "Rafiki wa kweli, rafiki wa kweli,",
            "Daima yu pamoja nami.",
          ]},
          { type: "verse", label: "Mstari 2", lines: [
            "Yeye ndiye nguvu zangu,",
            "Msaada wangu wa kweli,",
            "Hata gizani anang'aa,",
            "Nuru yake haiishi.",
          ]},
        ],
      },
      {
        id: 2, number: "002", title: "Bwana ni Mchungaji Wangu",
        sections: [
          { type: "verse", label: "Mstari 1", lines: [
            "Bwana ni mchungaji wangu,",
            "Sitapungukiwa na kitu;",
            "Hunifanya nilale sehemu",
            "Malisho mazuri ya kijani.",
          ]},
          { type: "chorus", label: "Kiitikio", lines: [
            "Mungu wangu, Mungu wangu,",
            "Wewe ni nguvu zangu,",
            "Mungu wangu, Mungu wangu,",
            "Nakukimbilia Wewe.",
          ]},
        ],
      },
      {
        id: 3, number: "003", title: "Nakupenda Yesu",
        sections: [
          { type: "verse", label: "Mstari 1", lines: [
            "Nakupenda Yesu kwa moyo wote,",
            "Maisha yangu yote ni yako,",
            "Umeniokolea dhambi zangu zote,",
            "Sasa niko huru kweli kweli.",
          ]},
          { type: "chorus", label: "Kiitikio", lines: [
            "Nakupenda, nakupenda Yesu,",
            "Unipenda, unipenda pia,",
            "Nakupenda, nakupenda Yesu,",
            "Milele na milele.",
          ]},
        ],
      },
      {
        id: 4, number: "004", title: "Furahia Daima",
        sections: [
          { type: "verse", label: "Mstari 1", lines: [
            "Furahia daima katika Bwana,",
            "Furaha yako ni nguvu zako,",
            "Hata wakati wa maumivu,",
            "Furahia katika Mungu wako.",
          ]},
          { type: "chorus", label: "Kiitikio", lines: [
            "Furahia, furahia katika Bwana,",
            "Furaha, furaha hii ni ya kweli,",
            "Furahia, furahia katika Bwana,",
            "Hii ndiyo nguvu yangu.",
          ]},
        ],
      },
      {
        id: 5, number: "005", title: "Msifuni Mungu",
        sections: [
          { type: "verse", label: "Mstari 1", lines: [
            "Msifuni Mungu kwa sauti kuu,",
            "Msifu jina lake takatifu,",
            "Yeye ni mkuu, yeye ni bora,",
            "Milele na milele.",
          ]},
          { type: "chorus", label: "Kiitikio", lines: [
            "Sifa, sifa, sifa kwa Mungu,",
            "Milele milele sifa,",
            "Sifa, sifa, sifa kwa Mungu,",
            "Yeye anastahili.",
          ]},
        ],
      },
      {
        id: 6, number: "006", title: "Njoo Kwangu Yesu",
        sections: [
          { type: "verse", label: "Mstari 1", lines: [
            "Njoo kwangu Yesu, mimi ni mchovu,",
            "Mzigo mzito umenigandamiza,",
            "Nipe pumziko, nipe nguvu,",
            "Wewe peke yako unaweza.",
          ]},
          { type: "chorus", label: "Kiitikio", lines: [
            "Ninakuja, ninakuja kwako Yesu,",
            "Mimi ni dhaifu lakini nakuja,",
            "Ninakuja, ninakuja kwako Yesu,",
            "Pokea moyo wangu sasa.",
          ]},
        ],
      },
    ],
  },

  // ── 3. Kwa Selma ──────────────────────────────────────────
  {
    id: "kwa-selma",
    name: "Kwa Selma",
    subtitle: "Dipina tsa Sione",
    language: "Sesotho",
    songs: [
      {
        id: 1, number: "001", title: "Re Bua Ka Lerato",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Re bua ka lerato la Morena,",
            "La molapo o phelang o sa khutleng,",
            "Ke yena feela ya ka iphihlileng,",
            "Lerato le sa feleng la ho rona.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Re bua, re bua, re bua ka lerato,",
            "Lerato la Kreste le re phetha,",
            "Re bua ka lerato la Morena,",
            "O re rata, o re rata ka ho rona.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Lerato lena la hae le phethahala,",
            "Ho fihlela lefatšeng lohle kaufela,",
            "Ha re phete tumelo ea rona,",
            "Morena o a re babalela.",
          ]},
        ],
      },
      {
        id: 2, number: "002", title: "Morena Ke Modisa Oa Ka",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Morena ke modisa oa ka,",
            "Ha ke tla hloka letho,",
            "O ntsholla mafulo a matala,",
            "Haufi le metsi a khotso.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ke ea khotso, ke ea khotso,",
            "Ke lebela ntlo ea Morena,",
            "Ke ea khotso, ke ea khotso,",
            "Ho fihlela ke phela teng.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Le ha nka tsamaea lehoatata,",
            "La seriti sa lefu,",
            "Ha ke tšabe bobe boo,",
            "Morena o ea le nna.",
          ]},
        ],
      },
      {
        id: 3, number: "003", title: "Ke Rata Jesu",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Ke rata Jesu hobane o ntrata,",
            "Boipiletso ba ka ke yena feela,",
            "O ile a itlhahela ka bophelo ba hae,",
            "Ke rata Jesu ka ho rona.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ke rata Jesu, ke rata Jesu,",
            "O rata le nna, o rata le wena,",
            "Ke rata Jesu, ke rata Jesu,",
            "Lerato la hae le phethahala.",
          ]},
        ],
      },
      {
        id: 4, number: "004", title: "Thabo Ea Morena",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Thabo ea Morena ke matla aka,",
            "Ha ke thabe ka tsebo ea lefatše,",
            "Ke thaba hobane Modimo o na le nna,",
            "Thabo ea hae e a ntshepetse.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ke a thaba, ke a thaba ka Morena,",
            "Thabo ea ka e tsoa ho yena,",
            "Ke a thaba, ke a thaba ka Morena,",
            "Ha ke tsoele ka thabo ya kae.",
          ]},
        ],
      },
      {
        id: 5, number: "005", title: "Khotso Ea Modimo",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Khotso ea Modimo e phethahala,",
            "E le khotso e fetang kutlwisiso,",
            "E boloka dipelo tsa rona,",
            "Ka Kreste Jesu Morena.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Khotso, khotso, khotso ea Morena,",
            "E phethahala dipelong tsa rona,",
            "Khotso, khotso, khotso ea Morena,",
            "Ke mpho e kholoanyane.",
          ]},
        ],
      },
    ],
  },

  // ── 4. Sacred Songs & Solos ───────────────────────────────
  {
    id: "sacred-songs",
    name: "Sacred Songs & Solos",
    subtitle: "Classic Hymns",
    language: "English",
    songs: [
      {
        id: 1, number: "001", title: "Rock of Ages",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Rock of Ages, cleft for me,",
            "Let me hide myself in Thee;",
            "Let the water and the blood,",
            "From Thy riven side which flowed,",
            "Be of sin the double cure,",
            "Cleanse me from its guilt and power.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Not the labors of my hands",
            "Can fulfill Thy law's demands;",
            "Could my zeal no respite know,",
            "Could my tears forever flow,",
            "All for sin could not atone;",
            "Thou must save, and Thou alone.",
          ]},
          { type: "verse", label: "Verse 3", lines: [
            "Nothing in my hand I bring,",
            "Simply to the cross I cling;",
            "Naked, come to Thee for dress;",
            "Helpless, look to Thee for grace;",
            "Foul, I to the fountain fly,",
            "Wash me, Savior, or I die.",
          ]},
        ],
      },
      {
        id: 2, number: "002", title: "The Old Rugged Cross",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "On a hill far away stood an old rugged cross,",
            "The emblem of suffering and shame;",
            "And I love that old cross where the dearest and best",
            "For a world of lost sinners was slain.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "So I'll cherish the old rugged cross,",
            "Till my trophies at last I lay down;",
            "I will cling to the old rugged cross,",
            "And exchange it some day for a crown.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "O that old rugged cross, so despised by the world,",
            "Has a wondrous attraction for me;",
            "For the dear Lamb of God left His glory above",
            "To bear it to dark Calvary.",
          ]},
        ],
      },
      {
        id: 3, number: "003", title: "Abide with Me",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Abide with me; fast falls the eventide;",
            "The darkness deepens; Lord, with me abide!",
            "When other helpers fail and comforts flee,",
            "Help of the helpless, O abide with me.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Swift to its close ebbs out life's little day;",
            "Earth's joys grow dim; its glories pass away;",
            "Change and decay in all around I see;",
            "O Thou who changest not, abide with me.",
          ]},
          { type: "verse", label: "Verse 3", lines: [
            "I need Thy presence every passing hour;",
            "What but Thy grace can foil the tempter's power?",
            "Who, like Thyself, my guide and stay can be?",
            "Through cloud and sunshine, Lord, abide with me.",
          ]},
        ],
      },
      {
        id: 4, number: "004", title: "Holy, Holy, Holy",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Holy, Holy, Holy! Lord God Almighty!",
            "Early in the morning our song shall rise to Thee;",
            "Holy, Holy, Holy! Merciful and mighty!",
            "God in three Persons, blessèd Trinity!",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Holy, Holy, Holy! Though the darkness hide Thee,",
            "Though the eye of sinful man Thy glory may not see;",
            "Only Thou art holy; there is none beside Thee,",
            "Perfect in power, in love and purity.",
          ]},
          { type: "verse", label: "Verse 3", lines: [
            "Holy, Holy, Holy! Lord God Almighty!",
            "All Thy works shall praise Thy name, in earth, and sky, and sea;",
            "Holy, Holy, Holy! Merciful and mighty!",
            "God in three Persons, blessèd Trinity!",
          ]},
        ],
      },
      {
        id: 5, number: "005", title: "Great Is Thy Faithfulness",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Great is Thy faithfulness, O God my Father,",
            "There is no shadow of turning with Thee;",
            "Thou changest not, Thy compassions, they fail not;",
            "As Thou hast been, Thou forever wilt be.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Great is Thy faithfulness!",
            "Great is Thy faithfulness!",
            "Morning by morning new mercies I see;",
            "All I have needed Thy hand hath provided,",
            "Great is Thy faithfulness, Lord, unto me!",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Summer and winter, and springtime and harvest,",
            "Sun, moon and stars in their courses above,",
            "Join with all nature in manifold witness",
            "To Thy great faithfulness, mercy and love.",
          ]},
        ],
      },
      {
        id: 6, number: "006", title: "It Is Well with My Soul",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "When peace, like a river, attendeth my way,",
            "When sorrows like sea billows roll;",
            "Whatever my lot, Thou hast taught me to say,",
            "It is well, it is well with my soul.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "It is well with my soul,",
            "It is well, it is well with my soul.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "My sin, oh the bliss of this glorious thought!",
            "My sin, not in part but the whole,",
            "Is nailed to the cross, and I bear it no more,",
            "Praise the Lord, praise the Lord, O my soul!",
          ]},
        ],
      },
    ],
  },

  // ── 5. Lifela tsa Sione ───────────────────────────────────
  {
    id: "lifela-tsa-sione",
    name: "Lifela tsa Sione",
    subtitle: "Morija Hymnal",
    language: "Sesotho",
    songs: [
      {
        id: 1, number: "001", title: "Halalela Morena",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Halalela Morena Modimo oa rona,",
            "Molaoli oa lefatše lohle,",
            "Lebitso la hao le halalela,",
            "Ho fihlela ho sena mafelelo.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Halalela, halalela, halalela Morena,",
            "Lehodimo le bua tlotla ea hao,",
            "Halalela, halalela, halalela Morena,",
            "Ntho tsohle di o hlompha.",
          ]},
          { type: "verse", label: "Verse 2", lines: [
            "Matsoho a hao a bopa lefatše,",
            "Molomo oa hao o hlahisa bophelo,",
            "Thato ea hao e phethahala,",
            "Ho fihlela mafelelo a mehla.",
          ]},
        ],
      },
      {
        id: 2, number: "002", title: "O Macha Morena",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "O macha Morena, o macha haholo,",
            "Lebitso la hao le phahamile,",
            "Ho fihlela ho sena mafelelo,",
            "O macha ho feta ntho tsohle.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ho halalela, ho halalela,",
            "Ho halalela Morena Modimo,",
            "Ho halalela, ho halalela,",
            "Lebitso la hao le halalela.",
          ]},
        ],
      },
      {
        id: 3, number: "003", title: "Leholimo Le Bolela",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Leholimo le bolela tlotla ea Modimo,",
            "Marang a lona a phatlalatsa mosebetsi,",
            "Letsatsi le hlahella le laoloa,",
            "Bosiu bo bolela boikhohomoso ba hae.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ho tlotlisa Modimo, ho tlotlisa Modimo,",
            "Mesebetsi eohle ea matsoho a hae,",
            "Ho tlotlisa Modimo, ho tlotlisa Modimo,",
            "Re bina ka mantsoe a thabo.",
          ]},
        ],
      },
      {
        id: 4, number: "004", title: "Bophelo Ba Ka Bo Matsohong",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Bophelo ba ka bo matsohong a hao,",
            "Morena ke o nea tsohle,",
            "Matsatsi a ka ke a hao,",
            "O ntsamaise ka tsela e nepahetseng.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ke a lapa, ke a lapa matsohong a hao,",
            "Ha ke tšabe letho ha ke na le wena,",
            "Ke a lapa, ke a lapa matsohong a hao,",
            "O ntshepetse, Morena oa ka.",
          ]},
        ],
      },
      {
        id: 5, number: "005", title: "Ke Tsamaile Le Morena",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Ke tsamaile le Morena tsatsing tsohle,",
            "O nthusitse ho feta mathata,",
            "Maoto a ka ha a kaa khakhala,",
            "Hobane Morena o ntshepisa.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Ke tsamaea, ke tsamaea le Morena,",
            "Motsamao oa ka o tsamaisoa ke hae,",
            "Ke tsamaea, ke tsamaea le Morena,",
            "Ho fihlela ke fihla hae.",
          ]},
        ],
      },
      {
        id: 6, number: "006", title: "Kea O Leboha Morena",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Kea o leboha Morena ka tsohle,",
            "Ka bophelo bo ntlafalitsoe ke wena,",
            "Ka molemo oa hao o sa feteng,",
            "Kea o leboha Morena oa ka.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Kea lebohisa, kea lebohisa Morena,",
            "Ka molemo oa hao o phethehileng,",
            "Kea lebohisa, kea lebohisa Morena,",
            "Lerato la hao ha le khaotsoe.",
          ]},
        ],
      },
    ],
  },

  // ── 6. Hosanna ────────────────────────────────────────────
  {
    id: "hosanna",
    name: "Hosanna",
    subtitle: "Songs of Praise",
    language: "English",
    songs: [
      {
        id: 1, number: "001", title: "Hosanna",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "I see the King of glory",
            "Coming on the clouds with fire,",
            "The whole earth shakes,",
            "The whole earth shakes.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Hosanna, hosanna,",
            "Hosanna in the highest!",
            "Hosanna, hosanna,",
            "Hosanna in the highest!",
          ]},
        ],
      },
      {
        id: 2, number: "002", title: "Shout to the Lord",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "My Jesus, my Savior,",
            "Lord, there is none like You.",
            "All of my days I want to praise",
            "The wonders of Your mighty love.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Shout to the Lord, all the earth, let us sing,",
            "Power and majesty, praise to the King;",
            "Mountains bow down and the seas will roar",
            "At the sound of Your name.",
          ]},
        ],
      },
      {
        id: 3, number: "003", title: "Here I Am to Worship",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Light of the world,",
            "You stepped down into darkness,",
            "Opened my eyes, let me see.",
            "Beauty that made this heart adore You,",
            "Hope of a life spent with You.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "Here I am to worship,",
            "Here I am to bow down,",
            "Here I am to say that You're my God.",
            "You're altogether lovely,",
            "Altogether worthy,",
            "Altogether wonderful to me.",
          ]},
        ],
      },
      {
        id: 4, number: "004", title: "Open the Eyes of My Heart",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Open the eyes of my heart, Lord,",
            "Open the eyes of my heart,",
            "I want to see You,",
            "I want to see You.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "To see You high and lifted up,",
            "Shining in the light of Your glory,",
            "Pour out Your power and love",
            "As we sing holy, holy, holy.",
          ]},
        ],
      },
      {
        id: 5, number: "005", title: "Majesty",
        sections: [
          { type: "verse", label: "Verse 1", lines: [
            "Majesty, worship His majesty,",
            "Unto Jesus be all glory, honor, and praise.",
            "Majesty, kingdom authority,",
            "Flow from His throne unto His own,",
            "His anthem raise.",
          ]},
          { type: "chorus", label: "Chorus", lines: [
            "So exalt, lift up on high the name of Jesus,",
            "Magnify, come glorify Christ Jesus, the King,",
            "Majesty, worship His majesty,",
            "Jesus who died, now glorified, King of all kings.",
          ]},
        ],
      },
    ],
  },
];

const TOTAL_SONGS = COLLECTIONS.reduce((s, c) => s + c.songs.length, 0);

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────

function StatusBar({ onYellow = false, onDark = false }: { onYellow?: boolean; onDark?: boolean }) {
  const fg = onDark ? "rgba(255,255,255,0.5)" : BK;
  return (
    <div className="flex items-center justify-between px-6 h-11 shrink-0" style={{ color: fg }}>
      <span className="text-[12px] font-semibold tracking-tight">9:41</span>
      <div className="absolute left-1/2 -translate-x-1/2 w-[90px] h-[30px] rounded-full"
        style={{ background: onDark ? "#0A0A08" : BK }} />
      <div className="flex items-center gap-1.5 text-[12px] font-medium">
        <span>●●●</span>
        <span>WiFi</span>
        <span className="font-semibold">100%</span>
      </div>
    </div>
  );
}

function NumberBadge({ n, inverted, sm }: { n: string; inverted?: boolean; sm?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center font-bold shrink-0 rounded`}
      style={{
        background: inverted ? BK : Y,
        color: inverted ? Y : BK,
        fontSize: sm ? "10px" : "11px",
        letterSpacing: "0.1em",
        padding: sm ? "3px 7px" : "4px 9px",
        minWidth: sm ? "36px" : "42px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {n}
    </span>
  );
}

function BottomNav({ active, onNav }: { active: Screen; onNav: (s: Screen) => void }) {
  const tabs = [
    { id: "home" as Screen, icon: Home, label: "Home" },
    { id: "search" as Screen, icon: Search, label: "Search" },
    { id: "favorites" as Screen, icon: Heart, label: "Favorites" },
    { id: "settings" as Screen, icon: Settings, label: "Settings" },
  ];
  const ai = tabs.findIndex((t) => t.id === active);
  return (
    <nav className="relative shrink-0" style={{ background: WH, borderTop: `1px solid ${BD}` }}>
      <div
        className="absolute top-0 transition-all duration-200 ease-out"
        style={{ height: "2px", background: Y, width: "25%", left: `${ai * 25}%` }}
      />
      <div className="flex h-[58px]">
        {tabs.map(({ id, icon: Icon, label }) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => onNav(id)}
              className="flex flex-col items-center justify-center flex-1 gap-[3px]">
              <Icon size={20} strokeWidth={on ? 2.2 : 1.7} color={on ? BK : T3} />
              <span className="text-[10px] leading-none" style={{ color: on ? BK : T3, fontWeight: on ? 600 : 400 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────────────────────

function SplashScreen({ onSkip }: { onSkip: () => void }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const dur = 2500, start = Date.now();
    const id = requestAnimationFrame(function tick() {
      const p = Math.min((Date.now() - start) / dur, 1);
      setPct(p);
      if (p < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <button onClick={onSkip} className="flex flex-col items-center justify-center h-full w-full"
      style={{ background: Y }}>
      {/* Emblem */}
      <div className="mb-8 relative">
        <div className="w-[96px] h-[96px] flex items-center justify-center"
          style={{ background: BK, borderRadius: "28px" }}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect x="23" y="4" width="6" height="44" rx="2" fill={Y} />
            <rect x="7" y="18" width="38" height="6" rx="2" fill={Y} />
            <circle cx="13" cy="38" r="3.5" fill={Y} opacity="0.5" />
            <circle cx="39" cy="12" r="3.5" fill={Y} opacity="0.5" />
          </svg>
        </div>
      </div>

      <h1 className="text-[32px] font-bold tracking-tight text-center leading-none mb-3"
        style={{ ...DP, color: BK }}>
        Morija Cantiques
      </h1>
      <p className="text-[11px] tracking-[0.3em] uppercase font-medium mb-20"
        style={{ color: "rgba(10,10,8,0.5)" }}>
        Morija Tabernacle
      </p>

      {/* Progress */}
      <div className="absolute bottom-10 left-12 right-12 h-[2px] rounded-full overflow-hidden"
        style={{ background: "rgba(10,10,8,0.15)" }}>
        <div className="h-full rounded-full" style={{ background: BK, width: `${pct * 100}%` }} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// HOME — collection dashboard
// ─────────────────────────────────────────────────────────────

function HomeScreen({
  onOpenCollection,
  onOpenSong,
  recentKeys,
  favorites,
}: {
  onOpenCollection: (id: string) => void;
  onOpenSong: (cid: string, sid: number) => void;
  recentKeys: string[];
  favorites: Set<string>;
}) {
  const recentItems = recentKeys
    .slice(0, 5)
    .map((k) => {
      const [cid, sid] = k.split("::");
      const col = COLLECTIONS.find((c) => c.id === cid);
      const song = col?.songs.find((s) => s.id === Number(sid));
      return col && song ? { col, song } : null;
    })
    .filter(Boolean) as { col: Collection; song: Song }[];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: CR }}>
      <StatusBar />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] mb-1.5 font-medium" style={{ color: T3 }}>
              Morija Tabernacle
            </p>
            <h1 className="text-[28px] font-bold leading-none" style={{ ...DP, color: BK }}>
              Cantiques
            </h1>
          </div>
          <div className="w-11 h-11 flex items-center justify-center shrink-0 mt-1"
            style={{ background: BK, borderRadius: "14px" }}>
            <svg width="24" height="24" viewBox="0 0 52 52" fill="none">
              <rect x="23" y="4" width="6" height="44" rx="2" fill={Y} />
              <rect x="7" y="18" width="38" height="6" rx="2" fill={Y} />
            </svg>
          </div>
        </div>

        {/* Recently opened */}
        {recentItems.length > 0 && (
          <div className="mb-7">
            <p className="px-5 text-[10px] font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: T2 }}>
              Recently Opened
            </p>
            <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {recentItems.map(({ col, song }) => (
                <button key={`${col.id}-${song.id}`}
                  onClick={() => onOpenSong(col.id, song.id)}
                  className="shrink-0 flex flex-col items-start p-3 rounded-2xl"
                  style={{ width: "108px", background: WH, border: `1px solid ${BD}` }}>
                  <NumberBadge n={song.number} sm />
                  <p className="text-[11px] font-semibold mt-2 text-left leading-snug"
                    style={{ color: BK }}>
                    {song.title}
                  </p>
                  <p className="text-[10px] mt-1 leading-none" style={{ color: T3 }}>
                    {col.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collections */}
        <div className="px-5 mb-2">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: T2 }}>
              Collections
            </p>
            <p className="text-[11px]" style={{ color: T3 }}>
              {TOTAL_SONGS} songs
            </p>
          </div>

          <div className="space-y-2">
            {COLLECTIONS.map((col, idx) => {
              const isFeatured = col.id === "lifela-tsa-sione";
              return (
                <button key={col.id}
                  onClick={() => onOpenCollection(col.id)}
                  className="w-full flex items-center rounded-2xl overflow-hidden"
                  style={{
                    background: isFeatured ? BK : WH,
                    border: `1px solid ${isFeatured ? BK : BD}`,
                    minHeight: "72px",
                  }}>
                  {/* Index */}
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: "56px", height: "72px" }}>
                    <span className="text-[22px] font-bold" style={{
                      ...DP,
                      color: isFeatured ? "rgba(255,255,0,0.3)" : "rgba(10,10,8,0.12)",
                      lineHeight: 1,
                    }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="w-px self-stretch shrink-0"
                    style={{ background: isFeatured ? "rgba(255,255,0,0.1)" : BD }} />

                  {/* Info */}
                  <div className="flex-1 px-4 py-3 text-left min-w-0">
                    <p className="text-[15px] font-bold truncate" style={{
                      ...DP,
                      color: isFeatured ? WH : BK,
                    }}>
                      {col.name}
                    </p>
                    <p className="text-[11px] mt-0.5 truncate" style={{
                      color: isFeatured ? "rgba(255,255,255,0.4)" : T3,
                    }}>
                      {col.subtitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: isFeatured ? "rgba(255,255,0,0.6)" : T2 }}>
                        {col.language}
                      </span>
                      <span style={{ color: isFeatured ? "rgba(255,255,255,0.2)" : BD }}>·</span>
                      <span className="text-[10px]" style={{ color: isFeatured ? "rgba(255,255,255,0.35)" : T3 }}>
                        {col.songs.length} songs
                      </span>
                    </div>
                  </div>

                  <div className="pr-4">
                    <ChevronRight size={14} color={isFeatured ? "rgba(255,255,255,0.25)" : BD} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pb-6" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COLLECTION — song list
// ─────────────────────────────────────────────────────────────

function CollectionScreen({
  collection,
  onBack,
  onOpenSong,
  favorites,
}: {
  collection: Collection;
  onBack: () => void;
  onOpenSong: (cid: string, sid: number) => void;
  favorites: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const filtered = collection.songs.filter((s) =>
    !query.trim() || s.title.toLowerCase().includes(query.toLowerCase()) || s.number.includes(query)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: CR }}>
      <StatusBar />

      {/* Header */}
      <div className="px-5 pt-2 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 mb-4 -ml-1">
          <ChevronLeft size={16} color={T2} />
          <span className="text-sm" style={{ color: T2 }}>Collections</span>
        </button>
        <h1 className="text-[22px] font-bold leading-tight" style={{ ...DP, color: BK }}>
          {collection.name}
        </h1>
        <p className="text-xs mt-1" style={{ color: T3 }}>
          {collection.subtitle} · {collection.language} · {collection.songs.length} songs
        </p>
      </div>

      {/* Search within collection */}
      <div className="px-5 pb-3 shrink-0">
        <div className="flex items-center gap-3 h-11 px-4 rounded-xl"
          style={{ background: WH, border: `1px solid ${BD}` }}>
          <Search size={14} color={T3} />
          <input type="text" placeholder="Search in this collection…"
            value={query} onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: BK }} />
          {query && <button onClick={() => setQuery("")}><X size={13} color={T3} /></button>}
        </div>
      </div>

      <p className="px-5 pb-2 text-xs shrink-0" style={{ color: T3 }}>
        {filtered.length} {filtered.length === 1 ? "song" : "songs"}
      </p>

      {/* List */}
      <div className="flex-1 mx-5 mb-5 overflow-y-auto rounded-2xl"
        style={{ border: `1px solid ${BD}`, background: WH, scrollbarWidth: "none" }}>
        {filtered.map((song, idx) => (
          <div key={song.id}>
            <button onClick={() => onOpenSong(collection.id, song.id)}
              className="w-full flex items-center gap-3 px-4 py-4">
              <NumberBadge n={song.number} sm />
              <span className="flex-1 text-sm font-semibold text-left" style={{ color: BK }}>
                {song.title}
              </span>
              {favorites.has(favKey(collection.id, song.id)) && (
                <Heart size={12} fill={BK} color={BK} className="shrink-0 opacity-60" />
              )}
              <ChevronRight size={13} color={BD} className="shrink-0" />
            </button>
            {idx < filtered.length - 1 && (
              <div className="h-px ml-[64px]" style={{ background: BD }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// READER — yellow background
// ─────────────────────────────────────────────────────────────

function ReaderScreen({
  collection,
  song,
  onBack,
  onProjector,
  isFav,
  onToggleFav,
}: {
  collection: Collection;
  song: Song;
  onBack: () => void;
  onProjector: () => void;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const [fontSize, setFontSize] = useState(19);
  const [night, setNight] = useState(false);

  // Day mode: yellow bg + black text
  // Night mode: very dark bg + warm off-white text
  const bg = night ? "#0D0D0A" : Y;
  const fg = night ? "#EDE8D6" : BK;
  const fg2 = night ? "rgba(237,232,214,0.45)" : "rgba(10,10,8,0.45)";
  const chorusBg = night ? "rgba(255,255,0,0.07)" : "rgba(10,10,8,0.07)";
  const chorusBorder = night ? Y : BK;
  const btnBg = night ? "rgba(255,255,255,0.08)" : "rgba(10,10,8,0.1)";
  const divCol = night ? "rgba(255,255,255,0.06)" : "rgba(10,10,8,0.1)";

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <StatusBar onYellow={!night} onDark={night} />

      {/* Nav bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${divCol}` }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 h-9 rounded-xl"
          style={{ background: btnBg }}>
          <ChevronLeft size={15} color={fg} />
          <span className="text-xs font-medium" style={{ color: fg }}>Back</span>
        </button>

        {/* Inverted badge on yellow */}
        <NumberBadge n={song.number} inverted={!night} />

        <div className="flex items-center gap-2">
          <button onClick={onToggleFav}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: btnBg }}>
            <Heart size={15} fill={isFav ? fg : "transparent"} color={fg} strokeWidth={1.8} />
          </button>
          <button onClick={() => setNight(!night)}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: btnBg }}>
            {night
              ? <Sun size={15} color={Y} strokeWidth={1.8} />
              : <Moon size={15} color={fg} strokeWidth={1.8} />}
          </button>
          <button onClick={onProjector}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: btnBg }}>
            <Maximize2 size={14} color={fg} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Song header */}
      <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${divCol}` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: fg2 }}>
          {collection.name}
        </p>
        <h1 className="text-[24px] font-bold leading-tight" style={{ ...DP, color: fg }}>
          {song.title}
        </h1>
      </div>

      {/* Lyrics */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24"
        style={{ scrollbarWidth: "none" }}>
        <div className="space-y-8">
          {song.sections.map((sec, i) => {
            const isC = sec.type === "chorus";
            return (
              <div key={i}>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-3"
                  style={{ color: isC ? fg : fg2 }}>
                  {sec.label}
                </p>
                <div style={{
                  paddingLeft: isC ? "14px" : "0",
                  borderLeft: isC ? `3px solid ${chorusBorder}` : "none",
                  background: isC ? chorusBg : "transparent",
                  borderRadius: isC ? "0 8px 8px 0" : "0",
                  padding: isC ? "10px 14px" : "0",
                }}>
                  {sec.lines.map((line, j) => (
                    <p key={j} style={{
                      fontSize: `${fontSize}px`,
                      fontWeight: isC ? 700 : 400,
                      color: fg,
                      lineHeight: 1.7,
                    }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Font controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 h-[60px]"
        style={{ background: bg, borderTop: `1px solid ${divCol}` }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setFontSize(Math.max(14, fontSize - 2))}
            disabled={fontSize <= 14}
            className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-30"
            style={{ background: btnBg }}>
            <Minus size={13} color={fg} />
          </button>
          <span className="text-xs font-semibold w-10 text-center" style={{ color: fg2 }}>
            {fontSize}px
          </span>
          <button onClick={() => setFontSize(Math.min(30, fontSize + 2))}
            disabled={fontSize >= 30}
            className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-30"
            style={{ background: btnBg }}>
            <Plus size={13} color={fg} />
          </button>
        </div>
        <p className="text-[11px]" style={{ color: fg2 }}>
          {song.sections.length} sections
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────

function SearchScreen({
  onOpenSong,
  favorites,
}: {
  onOpenSong: (cid: string, sid: number) => void;
  favorites: Set<string>;
}) {
  const [query, setQuery] = useState("");

  const results = query.trim().length < 1 ? [] : COLLECTIONS.flatMap((col) =>
    col.songs
      .filter((s) =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.number.includes(query)
      )
      .map((song) => ({ col, song }))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: CR }}>
      <StatusBar />

      <div className="px-5 pt-3 pb-3 shrink-0">
        <h1 className="text-xl font-semibold mb-4" style={{ color: BK }}>Search</h1>
        <div className="flex items-center gap-3 h-12 px-4 rounded-2xl"
          style={{ background: WH, border: `1px solid ${BD}` }}>
          <Search size={15} color={T3} />
          <input autoFocus type="text" placeholder="Song title or number…"
            value={query} onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base outline-none" style={{ color: BK }} />
          {query && <button onClick={() => setQuery("")}><X size={14} color={T3} /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ scrollbarWidth: "none" }}>
        {query.trim() === "" ? (
          <div className="flex flex-col items-center justify-center h-full pb-16" style={{ color: T3 }}>
            <BookOpen size={32} strokeWidth={1.4} className="mb-3" />
            <p className="text-sm font-medium" style={{ color: T2 }}>Search all collections</p>
            <p className="text-xs mt-1">{TOTAL_SONGS} songs across {COLLECTIONS.length} books</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-16">
            <p className="text-sm font-medium" style={{ color: T2 }}>No results for "{query}"</p>
          </div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: T3 }}>{results.length} results</p>
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BD}`, background: WH }}>
              {results.map(({ col, song }, idx) => (
                <div key={`${col.id}-${song.id}`}>
                  <button onClick={() => onOpenSong(col.id, song.id)}
                    className="w-full flex items-center gap-3 px-4 py-4">
                    <NumberBadge n={song.number} sm />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: BK }}>{song.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: T3 }}>{col.name}</p>
                    </div>
                    {favorites.has(favKey(col.id, song.id)) && (
                      <Heart size={12} fill={BK} color={BK} opacity={0.5} className="shrink-0" />
                    )}
                    <ChevronRight size={13} color={BD} className="shrink-0" />
                  </button>
                  {idx < results.length - 1 && (
                    <div className="h-px ml-[64px]" style={{ background: BD }} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FAVORITES
// ─────────────────────────────────────────────────────────────

function FavoritesScreen({
  favorites,
  onOpenSong,
  onRemoveFav,
}: {
  favorites: Set<string>;
  onOpenSong: (cid: string, sid: number) => void;
  onRemoveFav: (cid: string, sid: number) => void;
}) {
  const items = Array.from(favorites).map((k) => {
    const [cid, sid] = k.split("::");
    const col = COLLECTIONS.find((c) => c.id === cid);
    const song = col?.songs.find((s) => s.id === Number(sid));
    return col && song ? { col, song } : null;
  }).filter(Boolean) as { col: Collection; song: Song }[];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: CR }}>
      <StatusBar />
      <div className="px-5 pt-4 pb-4 shrink-0">
        <h1 className="text-xl font-semibold" style={{ color: BK }}>Favorites</h1>
        <p className="text-xs mt-1" style={{ color: T3 }}>
          {items.length} {items.length === 1 ? "song saved" : "songs saved"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pb-16">
          <div className="w-16 h-16 flex items-center justify-center mb-4 rounded-[20px]"
            style={{ background: WH, border: `1px solid ${BD}` }}>
            <Heart size={24} strokeWidth={1.5} color={T3} />
          </div>
          <p className="text-sm font-semibold mb-1.5" style={{ color: BK }}>No favorites yet</p>
          <p className="text-xs leading-relaxed" style={{ color: T3 }}>
            Open any song and tap the heart icon to save it here.
          </p>
        </div>
      ) : (
        <div className="flex-1 mx-5 mb-5 overflow-y-auto rounded-2xl"
          style={{ border: `1px solid ${BD}`, background: WH, scrollbarWidth: "none" }}>
          {items.map(({ col, song }, idx) => (
            <div key={favKey(col.id, song.id)}>
              <div className="flex items-center">
                <button onClick={() => onOpenSong(col.id, song.id)}
                  className="flex-1 flex items-center gap-3 px-4 py-4 min-w-0">
                  <NumberBadge n={song.number} sm />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold truncate" style={{ color: BK }}>{song.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: T3 }}>{col.name}</p>
                  </div>
                </button>
                <button onClick={() => onRemoveFav(col.id, song.id)} className="px-4 py-4 shrink-0">
                  <Heart size={14} fill={BK} color={BK} opacity={0.7} />
                </button>
              </div>
              {idx < items.length - 1 && (
                <div className="h-px ml-[64px] mr-4" style={{ background: BD }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────

function SettingsScreen() {
  const [keepOn, setKeepOn] = useState(true);
  const [notif, setNotif] = useState(false);

  function Toggle({ on, toggle }: { on: boolean; toggle: () => void }) {
    return (
      <button onClick={toggle} className="relative rounded-full transition-colors shrink-0"
        style={{ width: "44px", height: "26px", background: on ? BK : BD }}>
        <div className="absolute rounded-full bg-white transition-transform shadow-sm"
          style={{ width: "20px", height: "20px", top: "3px", left: "3px",
            transform: on ? "translateX(18px)" : "translateX(0)" }} />
      </button>
    );
  }

  const groups = [
    {
      label: "Reading",
      rows: [
        { label: "Keep Screen On", right: <Toggle on={keepOn} toggle={() => setKeepOn(!keepOn)} /> },
        { label: "Default Font Size", right: <span className="text-xs" style={{ color: T3 }}>Medium</span> },
      ],
    },
    {
      label: "Language & Region",
      rows: [
        { label: "Interface Language", right: <span className="text-xs" style={{ color: T3 }}>English</span> },
        { label: "Song Languages", right: <span className="text-xs" style={{ color: T3 }}>All</span> },
      ],
    },
    {
      label: "Notifications",
      rows: [
        { label: "Service Reminders", right: <Toggle on={notif} toggle={() => setNotif(!notif)} /> },
      ],
    },
    {
      label: "About",
      rows: [
        { label: "Version", right: <span className="text-xs" style={{ color: T3 }}>2.0.0</span> },
        { label: "Total Songs", right: <span className="text-xs" style={{ color: T3 }}>{TOTAL_SONGS}</span> },
        { label: "Collections", right: <span className="text-xs" style={{ color: T3 }}>{COLLECTIONS.length}</span> },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: CR }}>
      <StatusBar />
      <div className="px-5 pt-4 pb-5 shrink-0">
        <h1 className="text-xl font-semibold" style={{ color: BK }}>Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5" style={{ scrollbarWidth: "none" }}>
        {/* Brand banner */}
        <div className="rounded-2xl overflow-hidden flex items-stretch" style={{ background: BK, minHeight: "80px" }}>
          <div className="flex items-center justify-center px-5"
            style={{ background: Y, width: "64px" }}>
            <svg width="24" height="24" viewBox="0 0 52 52" fill="none">
              <rect x="23" y="4" width="6" height="44" rx="2" fill={BK} />
              <rect x="7" y="18" width="38" height="6" rx="2" fill={BK} />
            </svg>
          </div>
          <div className="flex flex-col justify-center px-4 py-4">
            <p className="text-[15px] font-bold text-white" style={DP}>Morija Cantiques</p>
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              Morija Tabernacle · {TOTAL_SONGS} songs
            </p>
          </div>
        </div>

        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2 px-1" style={{ color: T3 }}>
              {group.label}
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ background: WH, border: `1px solid ${BD}` }}>
              {group.rows.map((row, idx) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm" style={{ color: BK }}>{row.label}</span>
                    {row.right}
                  </div>
                  {idx < group.rows.length - 1 && (
                    <div className="h-px mx-4" style={{ background: BD }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROJECTOR
// ─────────────────────────────────────────────────────────────

function ProjectorScreen({ song, collection, onClose }: {
  song: Song;
  collection: Collection;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const sec = song.sections[idx];
  const isC = sec.type === "chorus";
  const total = song.sections.length;

  return (
    <div className="flex flex-col h-full select-none" style={{ background: "#080806" }}>
      {/* Top */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center font-bold rounded text-[11px] px-2 py-1"
            style={{ background: Y, color: BK, letterSpacing: "0.1em", minWidth: "42px" }}>
            {song.number}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: isC ? Y : "#3A3A2A" }}>
            {sec.label}
          </span>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ background: "#161612" }}>
          <X size={13} color="#3A3A2A" />
        </button>
      </div>

      {/* Lyrics */}
      <div className="flex-1 flex flex-col justify-center px-6">
        <div style={{
          borderLeft: isC ? `3px solid ${Y}` : "none",
          paddingLeft: isC ? "18px" : "0",
        }}>
          {sec.lines.map((line, i) => (
            <p key={i} className="mb-2" style={{
              fontSize: "22px",
              fontWeight: isC ? 700 : 400,
              color: isC ? WH : "#8A8468",
              lineHeight: 1.45,
            }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Song title */}
      <div className="px-6 pb-2 shrink-0">
        <p className="text-sm" style={{ ...DP, color: "#2E2E22", fontWeight: 600 }}>
          {song.title}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "#222218" }}>{collection.name}</p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderTop: "1px solid #141410" }}>
        <button onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-20"
          style={{ background: "#141410", color: "#6A6452" }}>
          <ChevronLeft size={13} />Prev
        </button>

        <div className="flex items-center gap-1.5">
          {song.sections.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className="rounded-full transition-all"
              style={{ width: i === idx ? "18px" : "6px", height: "6px",
                background: i === idx ? Y : "#242418" }} />
          ))}
        </div>

        <button onClick={() => setIdx(Math.min(total - 1, idx + 1))}
          disabled={idx === total - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-20"
          style={{ background: "#141410", color: "#6A6452" }}>
          Next<ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP SHELL
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [selCollId, setSelCollId] = useState<string | null>(null);
  const [selSongId, setSelSongId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["only-believe::2", "sacred-songs::5"]));
  const [recentKeys, setRecentKeys] = useState<string[]>(["only-believe::1", "nyimbo-za-okovu::3"]);
  const [backTo, setBackTo] = useState<Screen>("home");

  useEffect(() => {
    if (screen === "splash") {
      const t = setTimeout(() => setScreen("home"), 2700);
      return () => clearTimeout(t);
    }
  }, [screen]);

  function openCollection(cid: string) {
    setSelCollId(cid);
    setScreen("collection");
  }

  function openSong(cid: string, sid: number, from?: Screen) {
    setSelCollId(cid);
    setSelSongId(sid);
    setBackTo(from ?? screen);
    const k = favKey(cid, sid);
    setRecentKeys((p) => [k, ...p.filter((x) => x !== k)].slice(0, 12));
    setScreen("reader");
  }

  function toggleFav(cid: string, sid: number) {
    const k = favKey(cid, sid);
    setFavorites((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  const selColl = selCollId ? COLLECTIONS.find((c) => c.id === selCollId) ?? null : null;
  const selSong = selSongId != null && selColl ? selColl.songs.find((s) => s.id === selSongId) ?? null : null;

  const navScreens: Screen[] = ["home", "search", "favorites", "settings"];
  const showNav = navScreens.includes(screen) || screen === "collection";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0C0C0A" }}>
      {/* Device */}
      <div style={{
        width: "390px", height: "844px", borderRadius: "50px",
        background: "#111110", padding: "10px",
        boxShadow: "0 0 0 1px #222218, 0 32px 64px rgba(0,0,0,0.75), 0 8px 24px rgba(0,0,0,0.4)",
        position: "relative",
      }}>
        {/* Side buttons */}
        {[
          { side: "left", top: 130, h: 38 },
          { side: "left", top: 184, h: 62 },
          { side: "left", top: 258, h: 62 },
          { side: "right", top: 184, h: 90 },
        ].map((b, i) => (
          <div key={i} className="absolute" style={{
            [b.side]: "-3px", top: `${b.top}px`,
            width: "3px", height: `${b.h}px`,
            background: "#1C1C14",
            borderRadius: b.side === "left" ? "3px 0 0 3px" : "0 3px 3px 0",
          }} />
        ))}

        {/* Screen */}
        <div className="flex flex-col overflow-hidden" style={{
          width: "100%", height: "100%", borderRadius: "40px",
          background: screen === "projector" ? "#080806" : screen === "reader" ? Y : CR,
          position: "relative",
        }}>
          {/* Dynamic island */}
          {screen !== "splash" && (
            <div className="absolute z-50" style={{
              top: "10px", left: "50%", transform: "translateX(-50%)",
              width: "112px", height: "34px",
              background: screen === "reader" ? BK : "#080806",
              borderRadius: "20px",
            }} />
          )}

          {screen === "splash" && <SplashScreen onSkip={() => setScreen("home")} />}

          {screen === "home" && (
            <>
              <div className="flex-1 overflow-hidden">
                <HomeScreen onOpenCollection={openCollection}
                  onOpenSong={(cid, sid) => openSong(cid, sid, "home")}
                  recentKeys={recentKeys} favorites={favorites} />
              </div>
              <BottomNav active="home" onNav={setScreen} />
            </>
          )}

          {screen === "collection" && selColl && (
            <>
              <div className="flex-1 overflow-hidden">
                <CollectionScreen collection={selColl}
                  onBack={() => setScreen("home")}
                  onOpenSong={(cid, sid) => openSong(cid, sid, "collection")}
                  favorites={favorites} />
              </div>
              <BottomNav active="home" onNav={setScreen} />
            </>
          )}

          {screen === "reader" && selColl && selSong && (
            <ReaderScreen collection={selColl} song={selSong}
              onBack={() => setScreen(backTo)}
              onProjector={() => setScreen("projector")}
              isFav={favorites.has(favKey(selColl.id, selSong.id))}
              onToggleFav={() => toggleFav(selColl.id, selSong.id)} />
          )}

          {screen === "search" && (
            <>
              <div className="flex-1 overflow-hidden">
                <SearchScreen favorites={favorites}
                  onOpenSong={(cid, sid) => openSong(cid, sid, "search")} />
              </div>
              <BottomNav active="search" onNav={setScreen} />
            </>
          )}

          {screen === "favorites" && (
            <>
              <div className="flex-1 overflow-hidden">
                <FavoritesScreen favorites={favorites}
                  onOpenSong={(cid, sid) => openSong(cid, sid, "favorites")}
                  onRemoveFav={toggleFav} />
              </div>
              <BottomNav active="favorites" onNav={setScreen} />
            </>
          )}

          {screen === "settings" && (
            <>
              <div className="flex-1 overflow-hidden">
                <SettingsScreen />
              </div>
              <BottomNav active="settings" onNav={setScreen} />
            </>
          )}

          {screen === "projector" && selColl && selSong && (
            <ProjectorScreen song={selSong} collection={selColl}
              onClose={() => setScreen("reader")} />
          )}
        </div>
      </div>
    </div>
  );
}
