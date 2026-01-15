import React from 'react';

const GnosisLogo = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" id="gnosis">
        <path d="M63.93 19.8A43.86 43.86 0 0 1 96 33.6L64.09 65.5 32 33.43A43.9 43.9 0 0 1 63.93 19.8m0-5.21a49.33 49.33 0 0 0-39 19.11l39.16 39.18 39-39a49.31 49.31 0 0 0-39.16-19.29zM43.37 70.65a12.57 12.57 0 0 0 7.92-2.8L33.52 50.08a12.64 12.64 0 0 0 9.85 20.57zm41.26 0a12.63 12.63 0 0 0 10-20.38L76.9 68a12.55 12.55 0 0 0 7.73 2.65z" fill="currentColor"></path>
        <path d="m106.35 38.54-8 8A17.85 17.85 0 0 1 73.18 71.7l-9 9L55 71.55a17.85 17.85 0 0 1-25.18-25.16l-8-8.06a49.41 49.41 0 1 0 84.58.21Z" fill="currentColor"></path>
    </svg>
);

const FutarchyLogo = ({ className }) => (
    <svg className={className} viewBox="0 0 286 286" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M156.108 71.5372H272.892C280.116 71.5372 286 65.7309 286 58.5102V13.0271C286 5.80635 280.116 0 272.892 0H84.6083C77.3839 0 71.5 5.80635 71.5 13.0271V58.5102C71.5 65.7309 65.6161 71.5372 58.3917 71.5372H13.1083C5.88385 71.5372 0 77.3436 0 84.5643V272.973C0 280.194 5.88385 286 13.1083 286H58.3172C65.5417 286 71.4255 280.194 71.4255 272.973V156.027C71.4255 148.806 77.3094 143 84.5339 143H129.817C136.967 143 142.926 148.806 142.926 156.027V272.973C142.926 280.194 148.884 286 156.034 286H201.317C208.542 286 214.426 280.194 214.426 272.973V227.564C214.426 220.79 219.565 215.207 226.044 214.463H272.817C279.967 214.463 285.926 208.656 285.926 201.436V155.953C285.926 148.732 280.042 142.926 272.817 142.926H155.959C148.735 142.926 142.851 137.119 142.851 129.898V84.4899C142.851 77.2691 148.735 71.4628 155.959 71.4628L156.108 71.5372Z" fill="currentColor" />
    </svg>
);

const KlerosLogo = ({ className }) => (
    <svg className={className} version="1.0" xmlns="http://www.w3.org/2000/svg" viewBox="70 180 260 230" xmlSpace="preserve">
        <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M150.1,190l124.3,5.6l50.3,112l-71,102.4l-125-8L77.5,280.6L150.1,190z M241.2,254.6 L151.1,294l77,59.6L241.2,254.6z M230.8,234.8l-72-31l-15.1,65.3L230.8,234.8z M212.5,368.7l-78.3-56l1.9,75.8L212.5,368.7z M312.2,307.3l-53.3-54.2l-14.1,104.2L312.2,307.3z M230.9,380.8l-66,17.3l77.6,5L230.9,380.8z M301.8,331.9L244,375l11.5,22.5 L301.8,331.9z M274.5,211.2l-11.2,23.1l41.8,42.5L274.5,211.2z M260.5,200.2l-73.4-3l60.5,26.5L260.5,200.2z M139.4,210.9l-51.4,65 l34.4,7.3L139.4,210.9z M120.3,295.9l-34.5-7.3l36,85L120.3,295.9z" />
    </svg>
);

export const colorMotifs = {
    violet: {
        border: 'border-futarchyViolet7/30',
        bg: 'bg-futarchyViolet7/10',
        text: 'text-futarchyViolet7',
        borderColor: 'border-futarchyViolet7',
        buttonBg: 'bg-futarchyViolet9',
        buttonHoverBg: 'hover:bg-futarchyViolet10',
        buttonBorder: 'border-futarchyViolet9',
    },
    teal: {
        border: 'border-futarchyTeal7/30',
        bg: 'bg-futarchyTeal7/10',
        text: 'text-futarchyTeal7',
        borderColor: 'border-futarchyTeal7',
        buttonBg: 'bg-futarchyTeal9',
        buttonHoverBg: 'hover:bg-futarchyTeal10',
        buttonBorder: 'border-futarchyTeal9',
    },
    gold: {
        border: 'border-futarchyGold7/30',
        bg: 'bg-futarchyGold7/10',
        text: 'text-futarchyGold7',
        borderColor: 'border-futarchyGold7',
        buttonBg: 'bg-futarchyGold9',
        buttonHoverBg: 'hover:bg-futarchyGold10',
        buttonBorder: 'border-futarchyGold9',
    },
    blue: {
        border: 'border-futarchyBlue7/30',
        bg: 'bg-futarchyBlue7/10',
        text: 'text-futarchyBlue7',
        borderColor: 'border-futarchyBlue7',
        buttonBg: 'bg-futarchyBlue9',
        buttonHoverBg: 'hover:bg-futarchyBlue10',
        buttonBorder: 'border-futarchyBlue9',
    },
    crimson: {
        border: 'border-futarchyCrimson9/30',
        bg: 'bg-futarchyCrimson9/10',
        text: 'text-futarchyCrimson9',
        borderColor: 'border-futarchyCrimson9',
        buttonBg: 'bg-futarchyCrimson9',
        buttonHoverBg: 'hover:bg-futarchyCrimson10',
        buttonBorder: 'border-futarchyCrimson9',
    }
};

const getCompanyLogo = (companyId) => {
    switch (companyId) {
        case 9:
            return GnosisLogo;
        case 10:
            return KlerosLogo;
        default:
            return KlerosLogo; // Default fallback
    }
};

export const ShareProposalsCard = ({
    title,
    question,
    event,
    colorMotif = 'violet',
    companyId = 10, // Default to Kleros
    companyLogoUrl,
    customColor
}) => {
    const motif = colorMotifs[colorMotif] || colorMotifs.violet;
    const CompanyLogo = getCompanyLogo(companyId);

    // Helper to convert hex to rgba for background opacity
    const getBackgroundStyle = (color) => {
        if (!color) return {};
        // Simple hex to rgb conversion
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)` };
    };

    const getBorderStyle = (color) => {
        if (!color) return {};
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return { borderColor: `rgba(${r}, ${g}, ${b}, 0.3)` };
    };

    const customStyle = customColor ? {
        borderColor: customColor,
        ...getBorderStyle(customColor)
    } : {};

    const customBgStyle = customColor ? getBackgroundStyle(customColor) : {};
    const customTextStyle = customColor ? { color: customColor } : {};

    return (
        <div
            id="seo-image"
            className={`relative w-[680px] h-[380px] border-2 bg-futarchyDarkGray2 rounded-3xl p-6 overflow-hidden font-oxanium ${!customColor ? motif.border : ''}`}
            style={customStyle}
        >
            {/* Background Layers */}
            <div
                className={`absolute inset-0 ${!customColor ? motif.bg : ''}`}
                style={customBgStyle}
            ></div>

            {/* Watermark */}
            <div className="absolute inset-6 z-0">
                <FutarchyLogo className="w-full h-full text-white/10" />
            </div>

            {/* Content Wrapper */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-4">
                <header>
                    {companyLogoUrl ? (
                        <img src={companyLogoUrl} alt="Company Logo" className="w-24 h-24 object-contain rounded-full" />
                    ) : (
                        <CompanyLogo className={`w-24 h-24 ${!customColor ? motif.text : ''}`} style={customTextStyle} />
                    )}
                </header>

                <main className="text-center">
                    <h1 className="text-2xl font-bold text-white leading-tight max-w-3xl">
                        {title}{' '}
                        <span className={!customColor ? motif.text : ''} style={customTextStyle}>
                            {question}
                        </span>
                    </h1>
                </main>

                <footer>
                    <p className="text-sm text-white/80 text-center max-w-3xl mx-auto">
                        {event}
                    </p>
                </footer>
            </div>
        </div>
    );
};
