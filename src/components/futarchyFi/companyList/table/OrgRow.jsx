import React from 'react';
import Image from 'next/image';
import ChainBadge from '../components/ChainBadge';

/**
 * Single row in the Organizations table
 * Displays: Logo | Name + Active Badge | Active | Proposals | Chain
 */
const OrgRow = ({
    companyID,
    title,
    image,
    activeProposals = 0,
    proposalsCount = 0,
    chainId = 100, // Default to Gnosis
    hasActiveMarket = false,
    isOwner = false,
    onClick,
}) => {
    return (
        <tr
            onClick={onClick}
            className="border-b border-futarchyGray4 dark:border-futarchyGray112/20 hover:bg-futarchyGray3 dark:hover:bg-futarchyGray112/10 cursor-pointer transition-colors group"
        >
            {/* Logo */}
            <td className="py-4 px-4">
                <div className="w-10 h-10 relative rounded-full overflow-hidden bg-futarchyGray3 flex-shrink-0">
                    <Image
                        src={image || '/assets/fallback-company.png'}
                        alt={title}
                        layout="fill"
                        objectFit="cover"
                    />
                </div>
            </td>

            {/* Name + Badges */}
            <td className="py-4 px-2">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-futarchyGray12 dark:text-white group-hover:text-futarchyViolet7 transition-colors">
                        {title}
                    </span>
                    {hasActiveMarket && (
                        <span className="px-2 py-0.5 text-xs font-medium uppercase bg-futarchyTeal9/20 text-futarchyTeal9 rounded-full">
                            Active Market
                        </span>
                    )}
                    {isOwner && (
                        <span className="px-2 py-0.5 text-xs font-medium uppercase bg-purple-500/20 text-purple-400 rounded-full">
                            Owner
                        </span>
                    )}
                </div>
            </td>

            {/* Active Proposals Count */}
            <td className="py-4 px-4 text-center">
                <span className={`font-medium ${activeProposals > 0 ? 'text-futarchyTeal9' : 'text-futarchyGray11'}`}>
                    {activeProposals}
                </span>
            </td>

            {/* Total Proposals Count */}
            <td className="py-4 px-4 text-center">
                <span className="text-futarchyGray12 dark:text-white font-medium">
                    {proposalsCount}
                </span>
            </td>

            {/* Chain */}
            <td className="py-4 px-4">
                <ChainBadge chainId={chainId} size="sm" />
            </td>
        </tr>
    );
};

export default OrgRow;

