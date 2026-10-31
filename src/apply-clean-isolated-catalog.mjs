import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

export const STRICT_PRODUCT_REGISTRY = {
  // ── EARBUDS ─────────────────────────────────────────────────────────────
  'voltix-airpods-pro-181': {
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX AirPods Pro 181 Sound Engineering',
        title: 'Tuned for Depth. Engineered for Clarity.',
        description: 'Custom 13mm composite titanium drivers deliver deep dynamic bass without overshadowing vocal fidelity.',
        tag: 'ACOUSTIC MASTERY',
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

  'voltix-nirvana-ion-anc': {
    imageUrl: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Nirvana Ion ANC Silence',
        title: 'Active Noise Cancellation up to 32dB',
        description: 'Quad mics with crystal clear environmental noise suppression isolate your calls in high-decibel environments.',
        tag: '32dB HYBRID ANC',
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
        alt: 'VOLTIX ProBuds 311 PRO Studio Sound',
        title: 'Hi-Res Audio Certified with Dual Dynamic Drivers',
        description: 'Dual driver architecture delivers clinical separation between mid-tones and visceral bass.',
        tag: 'HI-RES ACOUSTICS',
        sortOrder: 1,
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
        alt: 'VOLTIX Nirvana Ion 120 Hours Playback',
        title: '120 Hours Total Playback. A Month of Sound.',
        description: 'Engineered with massive battery reserve and ASAP charge providing 24 hours playback in 10 minutes.',
        tag: '120 HOURS PLAYTIME',
        sortOrder: 1,
      },
    ],
  },

  'voltix-probuds-x1': {
    imageUrl: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX ProBuds X1 Minimalist Ergonomics',
        title: 'Featherlight 3.8g Fit with IPX5 Resistance',
        description: 'Contoured to the human ear canal for an effortless seal that remains locked in through intense cardio.',
        tag: 'FEATHERLIGHT FIT',
        sortOrder: 1,
      },
    ],
  },

  'voltix-gx-wireless-gaming-buds': {
    imageUrl: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX GX Wireless Gaming Buds Beast Mode',
        title: '40ms Ultra-Low Latency BEAST™ Mode with RGB',
        description: 'Zero perceptible audio lag ensures your auditory reflexes stay perfectly synced with high-FPS gameplay.',
        tag: '40MS ULTRA-LOW LATENCY',
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

  // ── WIRELESS HEADPHONES ─────────────────────────────────────────────────
  'voltix-rockerz-412': {
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Rockerz 412 Studio Acoustic',
        title: '40mm High-Fidelity Drivers with Punchy Bass',
        description: 'Immersive soundstage with ultra-plush memory foam earcups for non-fatiguing long listening sessions.',
        tag: 'STUDIO PRO AUDIO',
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
        alt: 'VOLTIX ArcWave 55 Spatial Audio',
        title: 'Immersive 3D Spatial Audio with Low Distortion',
        description: 'Acoustically calibrated chambers deliver tight transient response and wide orchestral separation.',
        tag: '3D SPATIAL SOUND',
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
        alt: 'VOLTIX Luxe ANC 900 Hybrid Silence',
        title: 'Flagship 38dB Hybrid ANC with Transparency Mode',
        description: 'Dual feedback and feedforward microphones cancel cabin drone and street rumble instantaneously.',
        tag: 'FLAGSHIP 38dB ANC',
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
        alt: 'VOLTIX GX Pro Gaming Headset',
        title: '7.1 Surround Sound with Broadcast Detachable Mic',
        description: 'Pinpoint acoustic cues, footsteps, and directional reloads with surgical 50mm neodymium drivers.',
        tag: '7.1 ESPORTS SURROUND',
        sortOrder: 1,
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
        alt: 'VOLTIX Storm Call 3 Display',
        title: '1.83" HD Display with Single-Chip Bluetooth Calling',
        description: 'Save up to 20 frequent contacts and dial directly from your wrist with clear onboard speaker and mic.',
        tag: 'BLUETOOTH CALLING',
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
        alt: 'VOLTIX Wave Fury Pro AMOLED',
        title: '1.96" Super AMOLED Display with Always-On Clock',
        description: '600 nits peak sunlight brightness with true deep blacks and 700+ customizable cloud watch faces.',
        tag: '1.96" SUPER AMOLED',
        sortOrder: 1,
      },
    ],
  },

  'voltix-gx-watch-ultimate': {
    imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX GX Watch Ultimate Rugged Build',
        title: 'Military Grade Zinc-Alloy Armor with 100+ Sports Modes',
        description: 'Shockproof and scratch-resistant casing engineered for mountain trails, swimming, and extreme sports.',
        tag: 'MILITARY SHOCKPROOF',
        sortOrder: 1,
      },
    ],
  },

  'voltix-smartwatch-s3': {
    imageUrl: 'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX SmartWatch S3 Health Engine',
        title: 'Continuous Biometric Sensor Suite with Sleep Staging',
        description: 'Real-time SpO2, heart rate variability, and guided breathing algorithms track your fitness 24/7.',
        tag: 'BIOMETRIC HEALTH SUITE',
        sortOrder: 1,
      },
    ],
  },

  // ── WIRELESS SPEAKERS ───────────────────────────────────────────────────
  'voltix-stone-180': {
    imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Stone 180 Outdoor Audio',
        title: '5W Signature Sound with IPX7 Water Immersion',
        description: 'Submersible design and rugged silicone bumper make it the ideal travel companion for beach, pool, and treks.',
        tag: 'IPX7 WATERPROOF',
        sortOrder: 1,
      },
    ],
  },

  'voltix-soundmaster-5000': {
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Soundmaster 5000 Party Speaker',
        title: '60W High-Octane Party Sound with Dual Passive Radiators',
        description: 'True Wireless Stereo pairing links two Soundmaster units for an expansive 120W wall of sound with strobe lights.',
        tag: '60W STEREO PARTY BASS',
        sortOrder: 1,
      },
    ],
  },

  // ── SOUNDBARS ───────────────────────────────────────────────────────────
  'voltix-aavante-bar-480': {
    imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Aavante Bar 480 Home Theater',
        title: '120W 2.1 Channel Cinema Bar with Wired Subwoofer',
        description: 'HDMI ARC, Optical, and AUX connectivity transform flat television sound into room-filling home theater.',
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
        description: 'Engineered for cinephiles who demand spatial realism and deep gut-punching sub-bass without tangled cables.',
        tag: 'DOLBY AUDIO 200W',
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

  // ── POWER BANKS ─────────────────────────────────────────────────────────
  'voltix-powerbank-20k': {
    imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX PowerBank 20K Fast Charging',
        title: '20,000mAh High-Density Cell with 22.5W Two-Way Fast Charge',
        description: 'Powers smartphones up to 5 times over. Equipped with 12 layers of circuit protection against surges and overheating.',
        tag: '22.5W TWO-WAY FAST CHARGE',
        sortOrder: 1,
      },
    ],
  },

  'voltix-energyshroom-pb300': {
    imageUrl: 'https://images.unsplash.com/photo-1609592807664-846497745778?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1609592807664-846497745778?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1609592807664-846497745778?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX EnergyShroom PB300 Dual Port',
        title: 'Dual Output 10,000mAh Slim Pocket Power Bank',
        description: 'Aircraft-safe compact aluminum shell charges two devices concurrently at optimized speeds.',
        tag: 'SLIM POCKET POWER',
        sortOrder: 1,
      },
    ],
  },

  'voltix-apex-pb400-pro': {
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Apex PB400 Pro 65W Laptop PD',
        title: '65W Power Delivery for Laptops, Tablets, and Flagship Phones',
        description: 'Massive capacity with real-time numeric LED display showing remaining wattage and charging speed.',
        tag: '65W LAPTOP PD CHARGE',
        sortOrder: 1,
      },
    ],
  },

  // ── TRIMMERS ────────────────────────────────────────────────────────────
  'voltix-slazer-k100': {
    imageUrl: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&q=80&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&q=80&auto=format&fit=crop',
    ],
    promotionalPosters: [
      {
        image: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=1600&q=85&auto=format&fit=crop',
        alt: 'VOLTIX Slazer K100 Beard Trimmer',
        title: 'Self-Sharpening Titanium Blades with 40 Length Settings',
        description: 'Precision dial with 0.5mm increments delivers clean fades, sharp lines, and 120 minutes cordless runtime.',
        tag: 'TITANIUM PRECISION',
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
        alt: 'VOLTIX ChargePad 15W Qi Fast Charging',
        title: '15W Fast Wireless Charging with Foreign Object Detection',
        description: 'Ultra-thin aircraft aluminum base with anti-slip rubber ring for instant drop-and-go inductive power.',
        tag: '15W QI INDUCTION',
        sortOrder: 1,
      },
    ],
  },
};

async function execute() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  // Safety check: verify real customer order
  const order = await mongoose.connection.collection('orders').findOne({ orderId: 'VO-278301-4806' });
  if (order) {
    console.log(`[SAFETY CHECK] Verified real customer order ${order.orderId} is intact.`);
  }

  const productsColl = mongoose.connection.collection('products');
  let updatedCount = 0;

  for (const [slug, item] of Object.entries(STRICT_PRODUCT_REGISTRY)) {
    const res = await productsColl.updateOne(
      { slug },
      {
        $set: {
          imageUrl: item.imageUrl,
          images: item.galleryImages, // Synchronize images array with clean isolated gallery
          galleryImages: item.galleryImages,
          promotionalPosters: item.promotionalPosters,
        },
      }
    );

    if (res.matchedCount > 0) {
      console.log(`✅ [ISOLATION APPLIED] "${slug}": images & galleryImages cleanly synchronized.`);
      updatedCount++;
    } else {
      console.warn(`⚠️ Slug not found in MongoDB: "${slug}"`);
    }
  }

  console.log(`\n🎉 Successfully updated and synchronized all ${updatedCount} products in MongoDB Atlas!`);
  await mongoose.disconnect();
}

execute().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

