"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { TransactionWorkflow, StepStatus } from "../types";
import { TRANSACTION_MODAL_MESSAGES } from "@/config/messages";

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    tradeDetails: any;
    workflow: TransactionWorkflow;
    executor: any; // Executor | null
}

export const TransactionModalUI: React.FC<TransactionModalProps> = ({ isOpen, onClose, tradeDetails, workflow, executor }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [status, setStatus] = useState<StepStatus>('IDLE');
    const [steps, setSteps] = useState<any[]>([]);
    const [loadingSteps, setLoadingSteps] = useState(false);

    useEffect(() => {
        if (isOpen && tradeDetails) {
            setCurrentStepIndex(0);
            setStatus('IDLE');
            setLoadingSteps(true);

            // Allow workflow to be async or sync
            Promise.resolve(workflow.getSteps(tradeDetails, executor))
                .then((fetchedSteps) => {
                    setSteps(fetchedSteps);
                    setLoadingSteps(false);
                })
                .catch(err => {
                    console.error("Failed to load steps", err);
                    setLoadingSteps(false);
                });
        }
    }, [isOpen, tradeDetails, workflow, executor]);

    if (!isOpen) return null;
    if (loadingSteps) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#111316] p-8 rounded-2xl flex flex-col items-center">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                    <p className="text-white font-oxanium">Analyzing Transaction...</p>
                </div>
            </div>
        );
    }

    // Safety check if steps failed to load
    if (steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];
    const isFinished = currentStepIndex >= steps.length;

    const handleConfirm = async () => {
        setStatus('WAITING_WALLET');

        // Simulate Wallet Interaction
        setTimeout(async () => {
            setStatus('PENDING_TX');

            // Execute the actual step logic
            await workflow.executeStep(currentStep.id, tradeDetails, executor);

            setStatus('SUCCESS');
            setTimeout(() => {
                if (currentStepIndex < steps.length - 1) {
                    setCurrentStepIndex(prev => prev + 1);
                    setStatus('IDLE');
                } else {
                    setCurrentStepIndex(prev => prev + 1);
                }
            }, 1000);

        }, 1500); // Initial Wallet Delay
    };

    const activeGroup = isFinished ? 2 : currentStep?.group;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full md:max-w-2xl bg-[#111316] rounded-t-3xl md:rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-none animate-in slide-in-from-bottom duration-300">

                <div className="flex p-4 gap-4">
                    {[1, 2].map(groupNum => (
                        <div key={groupNum} className={clsx(
                            "flex-1 p-3 rounded-lg border flex items-center gap-3 transition-colors",
                            activeGroup === groupNum ? "bg-slate-800 border-blue-500/50" : "bg-transparent border-slate-800 opacity-50"
                        )}>
                            <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                (isFinished || activeGroup > groupNum) ? "bg-green-500 text-white" : activeGroup === groupNum ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"
                            )}>
                                {(isFinished || activeGroup > groupNum) ? <Check size={14} /> : groupNum}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">
                                    {groupNum === 1 ? "Approve & Split" : "Execute"}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {groupNum === 1 ? "Prepare Assets" : "Finalize"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content */}
                <div className="p-6 space-y-6">
                    {isFinished ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">{TRANSACTION_MODAL_MESSAGES.COMPLETE}</h3>
                            <p className="text-slate-400">{workflow.getSuccessMessage(tradeDetails)}</p>

                            <div className="flex gap-2 text-sm justify-center mt-4 mb-8">
                                <span className="text-slate-400">Tx Hash:</span>
                                <a
                                    href={`https://gnosisscan.io/tx/${steps[steps.length - 1]?.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 underline font-mono"
                                >
                                    {steps[steps.length - 1]?.txHash?.substring(0, 6)}...{steps[steps.length - 1]?.txHash?.substring(62)}
                                </a>
                            </div>

                            <button onClick={onClose} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">
                                Close
                            </button>
                        </div>
                    ) : (
                        /* Ongoing Transaction UI */
                        <div className="flex-1 flex flex-col gap-6">

                            {/* Simulation / Balance Change Preview */}
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                                <p className="text-slate-400 text-sm uppercase tracking-wider font-semibold mb-4">{TRANSACTION_MODAL_MESSAGES.ESTIMATING}</p>
                                <div className="flex items-center justify-between gap-4">
                                    {/* Asset Leaving */}
                                    <div className="flex-1 bg-slate-950 rounded-lg p-3 border border-red-900/30 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <ArrowRight size={48} className="text-red-500 -rotate-45" />
                                        </div>
                                        <p className="text-xs text-red-400 font-bold mb-1">{TRANSACTION_MODAL_MESSAGES.LEAVING}</p>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-2xl font-bold text-white tracking-tight">{tradeDetails.amount}</p>
                                            <p className="text-sm font-bold text-slate-500">{tradeDetails.payToken}</p>
                                        </div>
                                        <p className="text-xs text-slate-500">{TRANSACTION_MODAL_MESSAGES.ASSET_OUT}</p>
                                    </div>

                                    <ArrowRight className="text-slate-600 animate-pulse" />

                                    {/* Asset Entering */}
                                    <div className="flex-1 bg-slate-950 rounded-lg p-3 border border-green-900/30 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <ArrowRight size={48} className="text-green-500 rotate-45" />
                                        </div>
                                        <p className="text-xs text-green-400 font-bold mb-1">{TRANSACTION_MODAL_MESSAGES.ENTERING}</p>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-2xl font-bold text-white tracking-tight">
                                                {tradeDetails.mode === 'SPLIT' ? tradeDetails.amount : '...'}
                                            </p>
                                            <p className="text-white font-mono font-bold">~</p>
                                            <p className="text-sm font-bold text-slate-500">{tradeDetails.side}</p>
                                        </div>
                                        <p className="text-xs text-slate-500">{TRANSACTION_MODAL_MESSAGES.ASSET_IN}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Contract Data */}
                            <div className="border border-slate-800 rounded-xl p-4 bg-black/20 font-mono text-xs text-slate-500 flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2 mb-2">
                                    <span>{TRANSACTION_MODAL_MESSAGES.METHOD}</span>
                                    <span className="text-blue-400">{currentStep.id.split('_')[1]?.toLowerCase() || 'execute'}()</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span>{TRANSACTION_MODAL_MESSAGES.TARGET}</span>
                                    <span className="text-blue-400 truncate w-32 ml-auto text-right">0x7495...228f</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isFinished && (
                    <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Reject
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={status !== 'IDLE'}
                            className="px-6 py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 min-w-[140px] flex items-center justify-center"
                        >
                            {status === 'IDLE' && TRANSACTION_MODAL_MESSAGES.STATUS.CONFIRM}
                            {status === 'WAITING_WALLET' && <span className="animate-pulse">{TRANSACTION_MODAL_MESSAGES.STATUS.CHECK_WALLET}</span>}
                            {status === 'PENDING_TX' && <><Loader2 size={16} className="animate-spin mr-2" /> {TRANSACTION_MODAL_MESSAGES.STATUS.PROCESSING}</>}
                            {status === 'SUCCESS' && <><Check size={16} className="mr-2" /> {TRANSACTION_MODAL_MESSAGES.STATUS.SUCCESS}</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
