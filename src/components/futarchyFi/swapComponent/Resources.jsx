export const SwapIcon = ({ className, fill }) => (
  <svg
    className={className}
    width="8"
    height="8"
    viewBox="0 0 8 8"
    fill={fill}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip0_219_9981)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.450684 5.34924L2.95089 6.04589L2.81668 6.52754L1.04056 6.03265L1.26786 7.84013L0.77177 7.90252L0.450684 5.34924Z"
        fill={fill}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.6878 6.11091C7.16028 5.5088 7.41692 4.76548 7.41657 4.00011L7.91657 3.99988C7.91697 4.87725 7.62278 5.72935 7.08115 6.41958C6.53951 7.10981 5.78181 7.59819 4.92951 7.80643C4.07721 8.01468 3.17967 7.93072 2.38078 7.56802C1.58188 7.20532 0.927905 6.58488 0.523682 5.80617L0.967454 5.57581C1.32007 6.25511 1.89057 6.79634 2.58747 7.11274C3.28438 7.42914 4.06734 7.50238 4.81084 7.32072C5.55433 7.13906 6.21531 6.71303 6.6878 6.11091Z"
        fill={fill}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.22819 0.0974121L7.54928 2.65069L5.04907 1.95404L5.18328 1.47239L6.9594 1.96728L6.7321 0.159798L7.22819 0.0974121Z"
        fill={fill}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.41235 0.88722C4.71544 0.570821 3.93248 0.497581 3.18898 0.679238C2.44549 0.860896 1.78451 1.28693 1.31202 1.88905C0.839537 2.49116 0.582899 3.23448 0.583252 3.99985L0.0832524 4.00008C0.0828471 3.12271 0.377042 2.27061 0.918674 1.58038C1.46031 0.89015 2.21801 0.401768 3.07031 0.193526C3.92261 -0.014716 4.82015 0.069243 5.61904 0.431943C6.41794 0.794644 7.07192 1.41508 7.47614 2.19379L7.03237 2.42415C6.67975 1.74485 6.10925 1.20362 5.41235 0.88722Z"
        fill={fill}
      />
    </g>
    <defs>
      <clipPath id="clip0_219_9981">
        <rect width="8" height="8" fill={fill} />
      </clipPath>
    </defs>
  </svg>
);

export const SplitIcon = ({ className }) => (
  <svg
    className={`${className} fill-current stroke-current`} // Use `fill-current` and `stroke-current` to inherit color
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 17L10 12M10 7L10 12M10 12L3 12M3 12L6 15M3 12L6 9"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 17L14 12M14 7L14 12M14 12L21 12M21 12L18 15M21 12L18 9"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MergeIcon = ({ className }) => (
  <svg
    className={`${className} fill-current stroke-current`} // Use `fill-current` and `stroke-current` to inherit color
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 7V12M3 17V12M3 12H10M10 12L7 9M10 12L7 15"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 7V12M21 17V12M21 12H14M14 12L17 9M14 12L17 15"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PlusIcon = ({ className, fill = "black" }) => (
  <svg
    className={className}
    fill={fill}
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8 2v6H2v2h6v6h2V10h6V8H10V2H8z" />
  </svg>
);

export const MinusIcon = ({ className, fill = "black" }) => (
  <svg
    className={className}
    fill={fill}
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2 7h12v2H2V7z" />
  </svg>
);

export const ReloadIcon = ({ className, fill }) => (
  <svg
    className={className}
    viewBox="0 0 8 8"
    fill={fill}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip0_219_9981)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.450684 5.34924L2.95089 6.04589L2.81668 6.52754L1.04056 6.03265L1.26786 7.84013L0.77177 7.90252L0.450684 5.34924Z"
        fill={fill}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.6878 6.11091C7.16028 5.5088 7.41692 4.76548 7.41657 4.00011L7.91657 3.99988C7.91697 4.87725 7.62278 5.72935 7.08115 6.41958C6.53951 7.10981 5.78181 7.59819 4.92951 7.80643C4.07721 8.01468 3.17967 7.93072 2.38078 7.56802C1.58188 7.20532 0.927905 6.58488 0.523682 5.80617L0.967454 5.57581C1.32007 6.25511 1.89057 6.79634 2.58747 7.11274C3.28438 7.42914 4.06734 7.50238 4.81084 7.32072C5.55433 7.13906 6.21531 6.71303 6.6878 6.11091Z"
        fill={fill}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.22819 0.0974121L7.54928 2.65069L5.04907 1.95404L5.18328 1.47239L6.9594 1.96728L6.7321 0.159798L7.22819 0.0974121Z"
        fill={fill}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.41235 0.88722C4.71544 0.570821 3.93248 0.497581 3.18898 0.679238C2.44549 0.860896 1.78451 1.28693 1.31202 1.88905C0.839537 2.49116 0.582899 3.23448 0.583252 3.99985L0.0832524 4.00008C0.0828471 3.12271 0.377042 2.27061 0.918674 1.58038C1.46031 0.89015 2.21801 0.401768 3.07031 0.193526C3.92261 -0.014716 4.82015 0.069243 5.61904 0.431943C6.41794 0.794644 7.07192 1.41508 7.47614 2.19379L7.03237 2.42415C6.67975 1.74485 6.10925 1.20362 5.41235 0.88722Z"
        fill={fill}
      />
    </g>
    <defs>
      <clipPath id="clip0_219_9981">
        <rect width="8" height="8" fill={fill} />
      </clipPath>
    </defs>
  </svg>
);