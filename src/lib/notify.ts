import { prisma } from "./prisma";

interface NotifyOpts {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
}

export async function createNotification(opts: NotifyOpts) {
  return prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message || null,
      link: opts.link || null,
    },
  });
}
