import { Queue } from 'bullmq';
import { config } from '../config/env';

// BullMQ uses ioredis internally and expects standard Redis connection options
const connection = {
    host: config.redis.host,
    port: config.redis.port,
};

export const exportQueue = new Queue('case_export_queue', { connection });

export interface ExportJobData {
    userId: string;
    userRole: string;
    userTeams: string[];
    caseIds: string[];
}

export class QueueService {
    static async addExportJob(jobId: string, data: ExportJobData) {
        // Add job to the queue
        await exportQueue.add('export_cases', data, {
            jobId,
            removeOnComplete: false, // Keep completed jobs so we know their status if polled
            removeOnFail: false,
        });
    }

    static async getExportJobStatus(jobId: string) {
        const job = await exportQueue.getJob(jobId);
        if (!job) {
            return null;
        }

        const state = await job.getState();
        const progress = job.progress;
        const returnvalue = job.returnvalue;
        const failedReason = job.failedReason;

        return {
            id: job.id,
            state,
            progress,
            result: returnvalue,
            error: failedReason,
        };
    }
}
