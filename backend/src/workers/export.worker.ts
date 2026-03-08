import { Worker, Job } from 'bullmq';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { ExportService } from '../services/export.service';

const connection = {
    host: config.redis.host,
    port: config.redis.port,
};

export const exportWorker = new Worker(
    'case_export_queue',
    async (job: Job) => {
        logger.info(`Processing export job ${job.id}`);
        const { userId, userRole, userTeams, caseIds } = job.data;

        try {
            const filePath = await ExportService.generateCaseArchiveFile(
                job.id!,
                caseIds,
                userId,
                userRole,
                userTeams,
                (progress: number) => {
                    job.updateProgress(progress);
                }
            );

            logger.info(`Export job ${job.id} completed. Archive at ${filePath}`);
            return { filePath };
        } catch (error: any) {
            logger.error(`Export job ${job.id} failed:`, error);
            throw error;
        }
    },
    { connection }
);

exportWorker.on('completed', (job) => {
    logger.info(`Job ${job.id} has completed!`);
});

exportWorker.on('failed', (job, err) => {
    if (job) {
        logger.error(`Job ${job.id} has failed with ${err.message}`);
    }
});
