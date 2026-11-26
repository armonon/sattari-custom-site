// Atlas refined splat, calibrated against reconstructed view-01.
// Generated concept with limited camera coverage; see docs/showroom-assets.json.
export const calibratedSourceCamera = {
  position: [1.1992587908552113, 1.3383362293243408, -1.4010743993876122],
  quaternion: [-0.005426727795522842, 0.9175156913852801, 0.004091856155734866, 0.3976415011042302],
  intrinsics: {
    fx: 852.442626953125,
    // eslint-disable-next-line no-loss-of-precision -- Preserve the Atlas camera JSON value.
    fy: 852.6143188476562,
    cx: 480,
    cy: 360,
    width: 960,
    height: 720,
  },
  sourceAspect: 1.3333333333333333,
  targetDistance: 4.16796875,
  near: 0.03,
  far: 30,
};

// Reversible frontal candidate fitted to the reconstructed wall plane. This
// viewpoint is outside the narrow capture fan and requires visual acceptance.
export const frontalShowroomCamera = {
  position: [1.6363217161555483, 1.4874804274466558, 0.7540354799112773],
  quaternion: [
    0.0012718657537637492, 0.7326046032880263, -0.0013689445535758303, 0.6806518960448926,
  ],
  targetDistance: 3.35,
  intrinsics: { ...calibratedSourceCamera.intrinsics, height: 540, cy: 270 },
  sourceAspect: 16 / 9,
  near: 0.03,
  far: 30,
};

export const gaussianShowroomConfig = {
  url: '/showroom/guitar-wall-front.spz',
  camera: frontalShowroomCamera,
  calibratedSourceCamera,
  viewportFit: 'cover',
  background: '#080a09',
  spotlight: {
    breakpoint: 700,
    desktopAnchor: [0.34, 0.53],
    desktopHeight: 0.84,
    mobileAnchor: [0.5, 0.31],
    mobileHeight: 0.45,
    neighborBrightness: 0.32,
    // Spark’s ellipsoid distance is anisotropic; this value feathers the
    // oval visibly without outlining the instrument or altering its opacity.
    softEdge: 0.6,
    allowOverscan: true,
    clipSource: true,
  },
  heroFrames: [
    { center: [0.5, 0.5], zoom: 1, mobileZoom: 0.9, cameraOffset: [-0.018, 0, 0], duration: 2200 },
    { slug: 'flame-stratocaster-electric-guitar', cameraOffset: [0.018, 0.004, 0], duration: 2200 },
    { slug: 'five-string-bass-guitar', cameraOffset: [-0.012, 0.008, 0], duration: 2200 },
    { slug: 'steel-string-acoustic-guitar', cameraOffset: [0.016, -0.004, 0], duration: 2200 },
  ],
  transform: {
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: 1,
  },
  navigation: {
    mode: 'orbit',
    allowLook: false,
    pan: false,
    zoomMode: 'crop',
    maxCropZoom: 3.2,
    focusZoom: 2.7,
    transitionDuration: 1400,
    minDistance: 3.35,
    maxDistance: 3.35,
    relativeOrbitLimits: {
      azimuth: {
        min: 0,
        max: 0,
      },
      polar: {
        min: 0,
        max: 0,
      },
    },
  },
  maxPixelRatio: 2,
  maxRenderPixels: 3000000,
  lod: false,
  hotspots: [
    {
      // Authored catalog display: first natural classical beside the bass.
      slug: 'classic-nylon-string-guitar',
      lightRegions: [
        {
          center: [-1.5123789466157962, 1.6409964057388857, 0.6480066953396468],
          halfSize: [0.16039163139999998, 0.6430965619663156, 0.45],
        },
      ],
      position: [-1.5146514497957215, 1.453893665514313, 0.6266628103379053],
      radius: 0.09869386714705701,
      focusTarget: [-1.5146514497957215, 1.65, 0.6266628103379053],
      focusZoom: 2.4,
      focusBounds: [
        [-1.4997875024, 2.1720345553, 0.7920064173],
        [-1.5218855246, 2.1253337213, 0.4942261724],
        [-1.5247811567, 1.2036415397, 0.5018088686],
        [-1.5027195806, 1.1976526295, 0.8017759698],
      ],
    },
    {
      slug: 'flame-stratocaster-electric-guitar',
      lightRegions: [
        {
          center: [-1.6001713079166928, 1.6851837108011194, 1.5104212181923407],
          halfSize: [0.2579097066, 0.7780980867469636, 0.45],
        },
      ],
      position: [-1.600941011490214, 1.4150891814734494, 1.5137141266170708],
      radius: 0.13254191124139186,
      focusBounds: [
        [-1.580594951, 2.3276996137, 1.7436227616],
        [-1.6164987207, 2.2532312683, 1.2597324908],
        [-1.6196250297, 1.1603241614, 1.2728967288],
        [-1.5837259868, 1.1487713515, 1.761101265],
      ],
    },
    {
      slug: 'five-string-bass-guitar',
      lightRegions: [
        {
          center: [-1.6177148007903541, 1.7000185813645143, 1.0377954789507142],
          halfSize: [0.2296701834, 0.8208818557209095, 0.45],
        },
      ],
      position: [-1.61982662342103, 1.3935602489276602, 1.0247093062427424],
      radius: 0.11766279404457262,
      focusBounds: [
        [-1.6000677766, 2.3778632589, 1.2429926758],
        [-1.6316645278, 2.3033513927, 0.8176068277],
        [-1.6351841529, 1.1461754792, 0.8286999322],
        [-1.6036255832, 1.134111557, 1.2579738607],
      ],
    },
    {
      slug: 'steel-string-acoustic-guitar',
      lightRegions: [
        {
          center: [-1.5257578895825692, 1.5417571489798991, -0.40715725523462143],
          halfSize: [0.21372051679999998, 0.710268986583799, 0.45],
        },
      ],
      position: [-1.5271145766125507, 1.3328235585923154, -0.41495042605671206],
      radius: 0.11560635215878923,
      focusBounds: [
        [-1.5086780889, 2.1282630497, -0.2050155163],
        [-1.539056185, 2.0527649426, -0.6137981801],
        [-1.5425982083, 1.0758670986, -0.6121854482],
        [-1.5123799974, 1.0521054337, -0.2005221904],
      ],
    },
  ],
  poster: '/images/showroom/guitar-wall-front.png',
};

export default gaussianShowroomConfig;
