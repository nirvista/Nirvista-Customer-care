import cron from "node-cron";
import { recalculateAllAgentStats } from "../services/ticketAssignmentService.js";

// Run every hour to sync agent stats
const startAgentStatsSync = () => {
    cron.schedule("0 * * * *", async () => {
        console.log("Running scheduled agent stats recalculation...");
        try {
            await recalculateAllAgentStats();
            console.log("Agent stats sync completed");
        } catch (error) {
            console.error("Agent stats sync failed:", error);
        }
    });

    console.log("Agent stats sync job scheduled (runs every hour at minute 0)");
};

export default startAgentStatsSync;