import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { InvalidFileTypeException } from '../common/exceptions/invalid-file-type.exception';
import { FileTooLargeException } from '../common/exceptions/file-too-large.exception';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class FilesService {
  private s3: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET');
    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('MINIO_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('MINIO_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
  }

  async upload(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) throw new InvalidFileTypeException();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) throw new InvalidFileTypeException();
    if (file.size > MAX_SIZE_BYTES) throw new FileTooLargeException();

    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const key = `products/${uuidv4()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return { url: `${this.endpoint}/${this.bucket}/${key}` };
  }
}
