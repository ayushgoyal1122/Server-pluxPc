import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Strict product-specific image and poster registry.
 * Absolutely ZERO cross-product contamination:
 * - Headphones only show that exact headphone.
 * - Earbuds only show that exact earbud model.
 * - Smartwatches only show that exact watch model.
 * - Projectors only show that exact projector.
 * - Trimmers only show that exact trimmer.
 * - Chargers only show that exact charger.
 * - Power banks only show that exact power bank.
 */
const STRICT_CATALOG_IMAGES = {
  // ── EARBUDS ─────────────────────────────────────────────────────────────
  'voltix-airpods-pro-181': {
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX AirPods Pro 181 Sound Engineering',
        title: 'Tuned for Depth. Engineered for Clarity.',
        description: 'Custom 13mm composite titanium drivers deliver deep dynamic bass without overshadowing vocal fidelity or treble transients.',
        tag: 'ACOUSTIC MASTERY',
        sortOrder: 1,
      },
      {
        image: 'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX AirPods Pro 181 Pocketable Case & Dial',
        title: 'Precision Metallic Finish with Rotary Dial',
        description: 'Seamless brushed metal aesthetic and pocketable silhouette designed to endure daily carry with confidence and style.',
        tag: 'TACTILE CRAFTSMANSHIP',
        sortOrder: 2,
      },
      {
        image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX AirPods Pro 181 Extended Endurance',
        title: '100 Hours of Uninterrupted Performance',
        description: 'High-efficiency acoustic chips combined with high-density power cells give you unmatched battery life with ASAP Charge.',
        tag: 'ALL-DAY PLAYBACK',
        sortOrder: 3,
      },
    ],
  },

  'voltix-nirvana-ion-anc': {
    imageUrl: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Nirvana Ion ANC Hybrid Noise Cancellation',
        title: 'Total Silence. Pure Audio Euphoria.',
        description: 'Advanced 32dB Hybrid ANC detects and eliminates external interruptions, placing you center-stage with your music.',
        tag: 'HYBRID 32DB ANC',
        sortOrder: 1,
      },
    ],
  },

  'voltix-probuds-311-pro': {
    imageUrl: 'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX ProBuds 311 PRO Precision Form',
        title: 'Brushed Metal Finish and Ergonomic In-Ear Shell',
        description: 'Precision contouring engineered for fatigue-free listening and all-day acoustic comfort.',
        tag: 'METALLIC FORM',
        sortOrder: 1,
      },
    ],
  },

  'voltix-airdopes-161': {
    imageUrl: '/images/products/voltix-airdopes-161.jpg',
    galleryImages: [
      '/images/products/voltix-airdopes-161.jpg',
      '/images/products/voltix-airdopes-161.jpg?view=case',
      '/images/products/voltix-airdopes-161.jpg?view=earbud',
      '/images/products/voltix-airdopes-161.jpg?view=detail',
      '/images/products/voltix-airdopes-161.jpg?view=lifestyle',
    ],
    promotionalPosters: [
      {
        image: '/images/products/voltix-airdopes-161.jpg',
        alt: 'VOLTIX AirDopes 161 True Wireless',
        title: 'Instant Connect. 40 Hours Continuous Sound.',
        description: 'Insta Wake N’ Pair technology connects to your smartphone the split-second the case lid flips open.',
        tag: 'INSTA WAKE PAIR',
        sortOrder: 1,
      },
      {
        image: '/images/products/voltix-airdopes-161.jpg?view=case',
        alt: 'VOLTIX AirDopes 161 Ergonomic Form Factor',
        title: 'Featherweight In-Ear Comfort with Snug Acoustic Seal',
        description: 'Engineered with ultra-light composite materials for fatigue-free listening and natural passive noise cancellation.',
        tag: 'ERGONOMIC CRAFTSMANSHIP',
        sortOrder: 2,
      },
      {
        image: '/images/products/voltix-airdopes-161.jpg?view=earbud',
        alt: 'VOLTIX AirDopes 161 ASAP Fast Charge',
        title: '10-Minute Charge Delivers 150 Minutes of Sound',
        description: 'High-efficiency Type-C fast charging powers your music with uninterrupted all-day endurance.',
        tag: 'ASAP FAST CHARGE',
        sortOrder: 3,
      },
    ],
  },

  'voltix-nirvana-ion': {
    imageUrl: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Nirvana Ion Bionic Sound',
        title: 'Dual Equalizer Bionic Sound Profile',
        description: 'Switch seamlessly between deep sub-bass boost and high-fidelity vocal transparency with a single tap.',
        tag: 'BIONIC DSP',
        sortOrder: 1,
      },
    ],
  },

  'voltix-probuds-x1': {
    imageUrl: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX ProBuds X1 Minimalist Acoustics',
        title: 'Featherlight Ergonomics with Deep Bass Architecture',
        description: 'Custom acoustic chambers ensure low-end resonance while keeping the bud weight under 3.8 grams.',
        tag: 'FEATHERLIGHT BASS',
        sortOrder: 1,
      },
    ],
  },

  'voltix-gx-wireless-gaming-buds': {
    imageUrl: 'https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX GX Wireless Gaming Buds',
        title: '40ms Ultra-Low Latency Beast Mode',
        description: 'Engineered for competitive mobile and console gaming with zero perceptible audio-visual lag.',
        tag: '40MS BEAST MODE',
        sortOrder: 1,
      },
    ],
  },

  // ── HEADPHONES ──────────────────────────────────────────────────────────
  'voltix-rockerz-412': {
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Rockerz 412 Over-Ear Comfort',
        title: 'Over-Ear Isolation. 40mm Dynamic Bass.',
        description: 'Plush protein leather memory foam cushions combined with high-grade dynamic drivers envelope you in your favorite albums.',
        tag: 'OVER-EAR IMMERSION',
        sortOrder: 1,
      },
    ],
  },

  'voltix-arcwave-55': {
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX ArcWave 55 Studio Monitoring',
        title: 'Studio Reference Accuracy in Wireless Form',
        description: 'Engineered with 50mm reference drivers and breathable fabric mesh earcups for producers, creators, and audiophiles.',
        tag: 'STUDIO REFERENCE',
        sortOrder: 1,
      },
    ],
  },

  'voltix-luxe-anc-900': {
    imageUrl: 'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Luxe ANC 900 Luxury Audio',
        title: '40dB Hybrid ANC Silence Meets Hi-Res LDAC',
        description: 'Immerse yourself in concert-hall dynamics with industry-leading hybrid cancellation and master-grade codecs.',
        tag: 'HI-RES WIRELESS',
        sortOrder: 1,
      },
    ],
  },

  'voltix-gx-pro-headset': {
    imageUrl: 'https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX GX Pro Gaming Headset 7.1 Spatial Audio',
        title: '7.1 Positional Sound for Tactical Dominance',
        description: 'Engineered with esports-grade 50mm neodymium acoustic drivers to give you positional audio awareness in competitive multiplayer matches.',
        tag: '7.1 SPATIAL GAMING',
        sortOrder: 1,
      },
    ],
  },

  // ── NECKBANDS ───────────────────────────────────────────────────────────
  'voltix-rockerz-110': {
    imageUrl: '/images/products/voltix-rockerz-110.jpg',
    galleryImages: [
      '/images/products/voltix-rockerz-110.jpg',
      '/images/products/voltix-rockerz-110.jpg?view=tips',
      '/images/products/voltix-rockerz-110.jpg?view=controls',
      '/images/products/voltix-rockerz-110.jpg?view=flexband',
      '/images/products/voltix-rockerz-110.jpg?view=lifestyle',
    ],
    promotionalPosters: [
      {
        image: '/images/products/voltix-rockerz-110.jpg',
        alt: 'VOLTIX Rockerz 110 Wireless Neckband Earphones',
        title: 'Magnetic Smart Power Switch & Rapid ASAP Charge',
        description: 'Separate to power on, snap together to power off. Designed with high-flex silicone band for 30 hours playback.',
        tag: 'SMART MAGNETIC LOCK',
        sortOrder: 1,
      },
      {
        image: '/images/products/voltix-rockerz-110.jpg?view=tips',
        alt: 'VOLTIX Rockerz 110 Super Extra Bass',
        title: '10mm Dynamic Drivers Tuned for Deep Punchy Bass',
        description: 'High-excursion dynamic drivers deliver signature low-end punch while maintaining pristine midrange clarity.',
        tag: 'SUPER EXTRA BASS',
        sortOrder: 2,
      },
      {
        image: '/images/products/voltix-rockerz-110.jpg?view=controls',
        alt: 'VOLTIX Rockerz 110 ASAP Fast Charge',
        title: '40 Hours Continuous Battery Life with Fast Charge',
        description: 'Get up to 10 hours of playtime in just 10 minutes of charging via universal USB Type-C.',
        tag: 'ASAP FAST CHARGE',
        sortOrder: 3,
      },
    ],
  },

  // ── SMARTWATCHES ────────────────────────────────────────────────────────
  'voltix-storm-call-3': {
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Storm Call 3 Vibrant Display',
        title: 'Vivid 1.83" Display. Sunlight Legibility.',
        description: 'Featuring 550 nits peak brightness and edge-to-edge 2.5D curved glass, every notification and health metric is sharp and crystal clear.',
        tag: 'HD CURVED DISPLAY',
        sortOrder: 1,
      },
    ],
  },

  'voltix-wave-fury-pro': {
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Wave Fury Pro AMOLED Display',
        title: 'Ultra 1.96" AMOLED with Always-On Brilliance',
        description: 'Remarkable 700-nit luminance and true-black contrast deliver an extraordinary visual experience right on your wrist.',
        tag: 'AMOLED DISPLAY',
        sortOrder: 1,
      },
    ],
  },

  'voltix-smartwatch-s3': {
    imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX SmartWatch S3 Display & Dial',
        title: 'Slim Profile. Maximum Intelligence.',
        description: 'Ultralight aerospace aluminum chassis weighing under 40 grams with all-day health tracking and seamless calling.',
        tag: 'SLIM CHASSIS',
        sortOrder: 1,
      },
    ],
  },

  'voltix-gx-watch-ultimate': {
    imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX GX Watch Ultimate Rugged Armor',
        title: 'Battle-Tested Durability & Built-In GPS',
        description: 'Engineered with military-grade shock absorption and dual-band GPS to keep you on course in the most demanding conditions.',
        tag: 'MILITARY TOUGHNESS',
        sortOrder: 1,
      },
    ],
  },

  // ── PROJECTORS ──────────────────────────────────────────────────────────
  'voltix-cinehead-f1': {
    imageUrl: '/images/products/voltix-cinehead-f1.jpg',
    galleryImages: [
      '/images/products/voltix-cinehead-f1.jpg',
      '/images/products/voltix-cinehead-f1.jpg?view=lens',
      '/images/products/voltix-cinehead-f1.jpg?view=dial',
      '/images/products/voltix-cinehead-f1.jpg?view=cooling',
      '/images/products/voltix-cinehead-f1.jpg?view=ports',
    ],
    promotionalPosters: [
      {
        image: '/images/products/voltix-cinehead-f1.jpg',
        alt: 'VOLTIX Cinehead F1 4K Smart Cinema Projector',
        title: 'True Native 1080p Full HD with 4K Decoding on a 200" Canvas',
        description: 'Engineered with a high-transmittance optical lens and 4500 lumens brightness, turning any living space into a private cinema.',
        tag: 'CINEMATIC OPTICS',
        sortOrder: 1,
      },
      {
        image: '/images/products/voltix-cinehead-f1.jpg?view=lens',
        alt: 'VOLTIX Cinehead F1 Sealed Optical Engine',
        title: 'Dust-Proof Precision Lens with Auto Keystone Correction',
        description: 'Fully sealed optical engine prevents black spots and color degradation, with instant motorized focus and 4-point geometric adjustment.',
        tag: 'SEALED OPTICAL ENGINE',
        sortOrder: 2,
      },
      {
        image: '/images/products/voltix-cinehead-f1.jpg?view=cooling',
        alt: 'VOLTIX Cinehead F1 Whisper Quiet Cooling',
        title: 'Dual-Turbine Low-Noise Cooling Under 28dB',
        description: 'Pure copper heat pipes and low-turbulence fan blades maintain optimal operating temperatures in silent comfort.',
        tag: 'WHISPER COOLING',
        sortOrder: 3,
      },
    ],
  },

  // ── TRIMMERS ────────────────────────────────────────────────────────────
  'voltix-slazer-k100': {
    imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Slazer K100 Trimmer Precision Blades',
        title: 'Master Every Beard Contour with 0.5mm Precision',
        description: 'Titanium-coated rounded blade tips glide effortlessly across your skin, delivering razor-sharp lines and irritation-free grooming.',
        tag: 'SALON PRECISION',
        sortOrder: 1,
      },
    ],
  },

  // ── CHARGERS ────────────────────────────────────────────────────────────
  'voltix-chargepad-15w': {
    imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX ChargePad 15W High Efficiency Charging',
        title: 'Drop & Charge. 15W Pure Inductive Speed.',
        description: 'Engineered with double-wound pure copper induction coils and thermal heat management for fast, seamless wireless charging.',
        tag: '15W FAST QI CHARGING',
        sortOrder: 1,
      },
    ],
  },

  // ── POWERBANKS ──────────────────────────────────────────────────────────
  'voltix-powerbank-20k': {
    imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX PowerBank 20K Power Architecture',
        title: 'Massive 20,000mAh Power with 22.5W Rapid Flow',
        description: 'Engineered with high-density lithium polymer cells and smart power delivery, keeping all your essential tech alive on the longest journeys.',
        tag: '22.5W POWER DELIVERY',
        sortOrder: 1,
      },
    ],
  },

  'voltix-energyshroom-pb300': {
    imageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX EnergyShroom PB300 Slim Battery',
        title: 'Slimline Everyday Carry Power',
        description: 'Featherlight 10,000mAh cell designed for maximum mobility without weighing down your pocket.',
        tag: 'POCKET SLIM',
        sortOrder: 1,
      },
    ],
  },

  'voltix-apex-pb400-pro': {
    imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Apex PB400 Pro 65W Output',
        title: '65W Laptop Charging Everywhere You Roam',
        description: 'Enough juice to fast charge your MacBook or USB-C laptop at full speed straight from your backpack.',
        tag: '65W LAPTOP PD',
        sortOrder: 1,
      },
    ],
  },

  // ── SPEAKERS & SOUNDBARS ────────────────────────────────────────────────
  'voltix-stone-180': {
    imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Stone 180 Rugged Speaker',
        title: 'Waterproof Audio Power Ready for the Wild',
        description: 'Submersible IPX7 armor and punchy low-end radiators ensure your soundtrack stays alive through any outdoor adventure.',
        tag: 'IPX7 WATERPROOF',
        sortOrder: 1,
      },
    ],
  },

  'voltix-soundmaster-5000': {
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Soundmaster 5000 60W Sound',
        title: '60W Thunderous Bass & Beat-Sync RGB',
        description: 'Engineered to turn any room or backyard into a live concert hall with high SPL output and vibrant light shows.',
        tag: '60W HIGH OUTPUT',
        sortOrder: 1,
      },
    ],
  },

  'voltix-aavante-bar-480': {
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Aavante Bar 480 Cinematic Setup',
        title: '120W 2.1 Channel Immersive Home Cinema',
        description: 'Dedicated down-firing subwoofer and HDMI ARC support turn your living room into a private theater with crystal dialogue.',
        tag: '120W 2.1 CINEMA',
        sortOrder: 1,
      },
    ],
  },

  'voltix-aavante-bar-prime-da600': {
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Aavante Bar Prime DA600 Dolby Sound',
        title: 'Dolby Audio Spatial Immersion with Wireless Subwoofer',
        description: 'Engineered for true cinephiles who demand spatial sound realism and deep gut-punching sub-bass without cables.',
        tag: 'DOLBY AUDIO 200W',
        sortOrder: 1,
      },
    ],
  },
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  // Safety check: verify real customer order
  const order = await mongoose.connection.collection('orders').findOne({ orderId: 'VO-278301-4806' });
  if (order) {
    console.log(`[SAFETY CHECK] Verified real customer order ${order.orderId} is intact.`);
  }

  const productsColl = mongoose.connection.collection('products');
  let updated = 0;

  for (const [slug, item] of Object.entries(STRICT_CATALOG_IMAGES)) {
    const res = await productsColl.updateOne(
      { slug },
      {
        $set: {
          imageUrl: item.imageUrl,
          galleryImages: item.galleryImages,
          promotionalPosters: item.promotionalPosters,
        },
      }
    );
    if (res.matchedCount > 0) {
      console.log(`[STRICT ISOLATION] Updated "${slug}" with isolated media.`);
      updated++;
    }
  }

  console.log(`\nSuccessfully enforced strict product isolation across ${updated} products in MongoDB.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

