// Designer intro (PurposeBound_Treasury_Full_Sequence.svg). The 12s master timeline
// was scaled to 3.4s so the SMIL plays fast and ONCE natively (IntroOverlay just wipes
// the overlay before the loop resets). No setCurrentTime/pauseAnimations — most robust.
export const INTRO_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="785" height="282" viewBox="-36 -34 785 282" role="img" aria-labelledby="title desc">
  <title id="title">PurposeBound Treasury — complete logo sequence</title>
  <desc id="desc">Twelve-second looping SVG: staggered letter reveal, liquid motion, floating hold, and reset.</desc>

  <defs>
    <linearGradient id="burgundy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#94002d"/>
      <stop offset="0.50" stop-color="#72001f"/>
      <stop offset="1" stop-color="#4d0015"/>
    </linearGradient>
    <linearGradient id="fluidBurgundy" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#540018"/>
      <stop offset="0.36" stop-color="#a5003b"/>
      <stop offset="0.55" stop-color="#ff8dab"/>
      <stop offset="0.68" stop-color="#8b002b"/>
      <stop offset="1" stop-color="#4d0015"/>
      <animate attributeName="x1" values="-0.55;0.25;-0.55" dur="4.8s" repeatCount="indefinite"/>
      <animate attributeName="x2" values="0.45;1.25;0.45" dur="4.8s" repeatCount="indefinite"/>
    </linearGradient>
    <filter id="softGlow" x="-25%" y="-40%" width="150%" height="180%">
      <feGaussianBlur stdDeviation="3.2" result="blur"/>
      <feFlood flood-color="#d92763" flood-opacity="0.35" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  
    <clipPath id="sequenceReveal" clipPathUnits="userSpaceOnUse"><rect x="15" y="8" width="108" height="0">
      <animate attributeName="height" values="0;0;158;158;0" keyTimes="0;0.000;0.075;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="116" y="42" width="59" height="0">
      <animate attributeName="height" values="0;0;90;90;0" keyTimes="0;0.018;0.093;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="169" y="40" width="58" height="0">
      <animate attributeName="height" values="0;0;96;96;0" keyTimes="0;0.036;0.111;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="218" y="38" width="62" height="0">
      <animate attributeName="height" values="0;0;120;120;0" keyTimes="0;0.054;0.129;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="272" y="38" width="54" height="0">
      <animate attributeName="height" values="0;0;96;96;0" keyTimes="0;0.072;0.147;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="315" y="36" width="57" height="0">
      <animate attributeName="height" values="0;0;98;98;0" keyTimes="0;0.090;0.165;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="360" y="34" width="60" height="0">
      <animate attributeName="height" values="0;0;104;104;0" keyTimes="0;0.108;0.183;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="394" y="8" width="98" height="0">
      <animate attributeName="height" values="0;0;138;138;0" keyTimes="0;0.126;0.201;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="484" y="38" width="58" height="0">
      <animate attributeName="height" values="0;0;96;96;0" keyTimes="0;0.144;0.219;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="530" y="38" width="66" height="0">
      <animate attributeName="height" values="0;0;96;96;0" keyTimes="0;0.162;0.237;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="585" y="38" width="63" height="0">
      <animate attributeName="height" values="0;0;96;96;0" keyTimes="0;0.180;0.255;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect><rect x="635" y="8" width="65" height="0">
      <animate attributeName="height" values="0;0;112;112;0" keyTimes="0;0.198;0.273;0.94;1" dur="3.4s" repeatCount="indefinite"/>
    </rect></clipPath>
    <filter id="sequenceFluid" x="-15%" y="-30%" width="130%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.009 0.03" numOctaves="2" seed="13" result="noise">
        <animate attributeName="baseFrequency" values="0.009 0.03;0.009 0.03;0.014 0.022;0.009 0.03" keyTimes="0;0.28;0.58;1" dur="3.4s" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="B">
        <animate attributeName="scale" values="0;0;7;2;0" keyTimes="0;0.28;0.58;0.82;1" dur="3.4s" repeatCount="indefinite"/>
      </feDisplacementMap>
    </filter>
  </defs>
  <g clip-path="url(#sequenceReveal)" filter="url(#sequenceFluid)">
    <path d="M 24 130 L 31 119 L 41 109 L 52 103 L 52 81 L 48 78 L 44 78 L 39 82 L 38 78 L 47 68 L 52 66 L 52 58 L 46 60 L 46 57 L 53 52 L 53 41 L 49 37 L 41 37 L 36 41 L 36 46 L 34 46 L 33 34 L 37 27 L 48 19 L 58 18 L 62 19 L 66 25 L 71 28 L 71 36 L 74 36 L 74 25 L 76 25 L 76 22 L 78 22 L 78 33 L 84 33 L 97 21 L 114 33 L 116 36 L 116 103 L 99 113 L 90 123 L 77 119 L 79 151 L 66 145 L 60 145 L 50 152 L 47 151 L 52 145 L 52 119 L 43 119 L 36 122 L 26 133 L 24 133 Z M 401 37 L 405 28 L 411 22 L 418 19 L 425 20 L 436 26 L 445 26 L 447 24 L 448 27 L 453 27 L 459 21 L 463 21 L 478 31 L 478 52 L 474 58 L 464 64 L 464 67 L 478 74 L 482 79 L 482 111 L 451 136 L 446 136 L 428 128 L 416 128 L 408 132 L 405 136 L 401 135 L 422 112 L 421 82 L 418 80 L 409 82 L 409 80 L 414 73 L 419 70 L 419 52 L 417 52 L 416 49 L 431 41 L 431 38 L 422 38 L 412 33 L 406 34 L 404 40 L 402 40 Z M 645 37 L 656 19 L 656 29 L 658 33 L 665 36 L 683 53 L 686 59 L 689 59 L 688 108 L 681 113 L 679 113 L 678 104 L 674 96 L 673 66 L 666 59 L 663 59 L 663 96 L 662 93 L 648 84 L 648 66 L 657 61 L 661 57 L 661 54 L 645 40 Z M 447 35 L 447 69 L 450 69 L 460 60 L 460 41 L 452 35 Z M 78 40 L 78 65 L 97 65 L 99 58 L 98 44 L 88 36 L 84 36 Z M 429 110 L 429 113 L 442 113 L 464 119 L 464 82 L 460 77 L 455 75 L 447 76 L 447 98 L 445 101 L 443 100 L 443 39 L 440 39 L 440 104 Z M 71 45 L 71 107 L 74 107 L 74 45 Z M 318 120 L 330 104 L 346 109 L 346 89 L 342 89 L 337 96 L 333 97 L 333 93 L 325 88 L 325 64 L 332 61 L 345 50 L 353 55 L 357 55 L 358 49 L 356 45 L 358 45 L 361 48 L 361 55 L 356 63 L 351 67 L 340 64 L 340 80 L 344 81 L 348 75 L 351 75 L 361 82 L 361 108 L 340 124 L 330 118 L 324 118 L 319 126 Z M 174 61 L 180 57 L 186 49 L 196 57 L 196 60 L 199 60 L 208 49 L 219 61 L 222 61 L 233 49 L 243 57 L 243 60 L 248 59 L 256 50 L 260 51 L 269 59 L 268 109 L 250 123 L 246 123 L 246 143 L 244 145 L 236 144 L 225 152 L 222 150 L 226 145 L 226 117 L 222 116 L 219 120 L 216 120 L 216 118 L 226 109 L 226 65 L 224 63 L 218 63 L 209 74 L 206 73 L 202 66 L 198 66 L 196 70 L 196 107 L 200 110 L 207 107 L 208 110 L 191 124 L 185 118 L 177 114 L 180 109 L 180 66 L 178 63 L 174 63 Z M 276 112 L 278 65 L 301 49 L 316 59 L 316 108 L 294 124 Z M 367 111 L 368 65 L 379 59 L 391 49 L 396 49 L 407 70 L 384 89 L 383 104 L 392 110 L 398 109 L 404 102 L 406 102 L 407 105 L 387 124 L 368 114 Z M 490 111 L 491 65 L 515 49 L 531 60 L 531 108 L 523 112 L 509 124 L 506 124 L 491 114 Z M 537 60 L 539 60 L 548 49 L 559 58 L 557 62 L 557 106 L 561 109 L 565 109 L 567 108 L 567 64 L 563 60 L 567 58 L 573 50 L 586 59 L 583 63 L 582 95 L 583 107 L 589 112 L 578 124 L 569 114 L 565 114 L 555 124 L 541 114 L 542 64 L 538 63 Z M 590 60 L 592 60 L 601 49 L 606 51 L 612 60 L 615 60 L 626 49 L 639 59 L 637 63 L 637 81 L 623 81 L 622 74 L 624 69 L 627 69 L 627 66 L 622 67 L 614 63 L 614 65 L 612 65 L 612 86 L 607 88 L 597 99 L 597 65 L 595 63 L 591 64 Z M 121 61 L 132 50 L 144 59 L 142 61 L 142 107 L 149 109 L 151 108 L 151 64 L 147 62 L 147 59 L 157 50 L 160 50 L 164 56 L 170 59 L 167 63 L 167 107 L 173 110 L 173 112 L 162 124 L 158 122 L 152 114 L 144 117 L 138 124 L 124 113 L 126 110 L 126 65 Z M 292 62 L 292 106 L 297 110 L 301 110 L 301 66 Z M 506 63 L 506 106 L 511 110 L 515 110 L 515 67 L 510 63 Z M 243 66 L 243 107 L 253 110 L 253 67 L 249 64 Z M 384 65 L 384 82 L 387 82 L 392 77 L 392 74 L 388 66 Z M 78 68 L 78 79 L 98 79 L 98 68 Z M 78 82 L 78 101 L 98 107 L 98 83 Z M 71 117 L 71 139 L 74 139 L 74 117 Z" fill="url(#fluidBurgundy)" fill-rule="evenodd"/>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -3;0 0;0 0" keyTimes="0;0.57;0.72;0.88;1" dur="3.4s" repeatCount="indefinite"/>
  </g>
  <g><g fill="#32151f" stroke="#32151f" id="g21">
    <path d="M 120 185 H 236.5" stroke-width="1.25" id="path15" />
    <path d="M 476.5 185 H 593" stroke-width="1.25" id="path17" />
    <g aria-label="TREASURY" id="text19" style="font-size:17px;font-family:'DejaVu Sans';letter-spacing:12;text-anchor:middle;stroke:none">
      <path d="m 269.99536,178.60693 h 10.48389 v 1.41114 h -4.39942 V 191 h -1.68505 v -10.98193 h -4.39942 z" id="path27" />
      <path d="m 299.97485,185.18945 q 0.53955,0.18262 1.0459,0.78028 0.51465,0.59765 1.0293,1.64355 L 303.75171,191 h -1.80127 l -1.58545,-3.1792 q -0.61426,-1.24512 -1.19531,-1.65185 -0.57276,-0.40674 -1.56885,-0.40674 h -1.82617 V 191 h -1.67676 v -12.39307 h 3.78516 q 2.125,0 3.1709,0.88819 1.04589,0.88818 1.04589,2.68115 0,1.17041 -0.54785,1.94238 -0.53955,0.77197 -1.57715,1.0708 z m -4.20019,-5.20459 v 4.39942 h 2.1084 q 1.21191,0 1.82617,-0.55616 0.62256,-0.56445 0.62256,-1.65185 0,-1.0874 -0.62256,-1.63525 -0.61426,-0.55616 -1.82617,-0.55616 z" id="path29" />
      <path d="m 317.90991,178.60693 h 7.83594 v 1.41114 h -6.15918 v 3.66894 h 5.90186 v 1.41113 h -5.90186 v 4.49073 h 6.30859 V 191 h -7.98535 z" id="path31" />
      <path d="m 344.79321,180.25879 -2.27441,6.16748 h 4.55713 z m -0.94629,-1.65186 h 1.90088 L 350.47095,191 h -1.74317 l -1.1289,-3.1792 h -5.58643 L 340.88354,191 h -1.76806 z" id="path33" />
      <path d="m 371.70972,179.01367 v 1.63526 q -0.95459,-0.45655 -1.80127,-0.68067 -0.84668,-0.22412 -1.63526,-0.22412 -1.36963,0 -2.1167,0.53125 -0.73877,0.53125 -0.73877,1.51074 0,0.82178 0.48975,1.24512 0.49805,0.41504 1.87598,0.67236 l 1.01269,0.20752 q 1.87598,0.35694 2.76416,1.26172 0.89649,0.89649 0.89649,2.40723 0,1.80127 -1.21192,2.73096 -1.20361,0.92968 -3.53613,0.92968 -0.87988,0 -1.87598,-0.19922 -0.98779,-0.19921 -2.05029,-0.58935 v -1.72656 q 1.021,0.57275 2.00049,0.86328 0.97949,0.29052 1.92578,0.29052 1.43604,0 2.21631,-0.56445 0.78027,-0.56445 0.78027,-1.61035 0,-0.91309 -0.56445,-1.42773 -0.55615,-0.51465 -1.83447,-0.77198 l -1.021,-0.19922 q -1.87598,-0.37353 -2.71436,-1.17041 -0.83837,-0.79687 -0.83837,-2.2163 0,-1.64356 1.1538,-2.58985 1.16211,-0.94629 3.19581,-0.94629 0.87158,0 1.77636,0.15772 0.90479,0.15771 1.85108,0.47314 z" id="path35" />
      <path d="m 386.88062,178.60693 h 1.68505 v 7.52881 q 0,1.99219 0.72217,2.87207 0.72217,0.87158 2.34082,0.87158 1.61035,0 2.33252,-0.87158 0.72217,-0.87988 0.72217,-2.87207 v -7.52881 h 1.68506 v 7.73633 q 0,2.42383 -1.20362,3.66065 -1.19531,1.23681 -3.53613,1.23681 -2.34912,0 -3.55273,-1.23681 -1.19531,-1.23682 -1.19531,-3.66065 z" id="path37" />
      <path d="m 417.39136,185.18945 q 0.53955,0.18262 1.0459,0.78028 0.51464,0.59765 1.02929,1.64355 L 421.16821,191 h -1.80127 l -1.58545,-3.1792 q -0.61425,-1.24512 -1.19531,-1.65185 -0.57275,-0.40674 -1.56885,-0.40674 h -1.82617 V 191 h -1.67676 v -12.39307 h 3.78516 q 2.125,0 3.1709,0.88819 1.0459,0.88818 1.0459,2.68115 0,1.17041 -0.54785,1.94238 -0.53955,0.77197 -1.57715,1.0708 z m -4.2002,-5.20459 v 4.39942 h 2.1084 q 1.21191,0 1.82617,-0.55616 0.62256,-0.56445 0.62256,-1.65185 0,-1.0874 -0.62256,-1.63525 -0.61426,-0.55616 -1.82617,-0.55616 z" id="path39" />
      <path d="m 432.53735,178.60693 h 1.80127 l 3.43653,5.09668 3.41162,-5.09668 h 1.80127 l -4.38282,6.49121 V 191 h -1.68505 v -5.90186 z" id="path41" />
    </g>
  </g>
    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.25;0.32;0.94;1" dur="3.4s" repeatCount="indefinite"/>
  </g>
</svg>`;
