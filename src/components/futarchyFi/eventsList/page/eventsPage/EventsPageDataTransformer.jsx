import axios from "axios";

// Mock events data
const mockEvents = [
  {
    eventID: "EVT-1",
    eventStatus: "upcoming",
    countdownFinish: false,
    timestamp: Date.now() / 1000 + 86400 * 2, // 2 days from now
    endTime: Date.now() / 1000 + 86400 * 5,
    tags: ["Conference", "DeFi"],
    prices: { attendance: "$50", vip: "$150" },
    eventTitle: "FutarchyFi DeFi Summit 2024",
    eventsDocMarket: [{ eventsDoc: "doc1", eventMarket: "market1" }],
    participatingUsers: [
      { address: "0x1234...5678", ticket: "VIP" },
      { address: "0x8765...4321", ticket: "Standard" },
    ],
  },
  // ... more mock events
];

export const fetchAndTransformEvents = async () => {
  // Similar implementation to proposals data transformer
}; 