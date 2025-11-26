//  NotificationService.m
//  ShopUnite Notification Service Extension

#import "NotificationService.h"

@interface NotificationService ()

@property (nonatomic, strong) void (^contentHandler)(UNNotificationContent *contentToDeliver);
@property (nonatomic, strong) UNNotificationRequest *receivedRequest;
@property (nonatomic, strong) UNMutableNotificationContent *bestAttemptContent;

@end

@implementation NotificationService

- (void)didReceiveNotificationRequest:(UNNotificationRequest *)request withContentHandler:(void (^)(UNNotificationContent * _Nonnull))contentHandler {
    self.receivedRequest = request;
    self.contentHandler = contentHandler;
    self.bestAttemptContent = [request.content mutableCopy];

    NSDictionary *userInfo = request.content.userInfo;

    // Debug: Log the entire userInfo to see what we receive
    NSLog(@"[ShopUnite NSE] Received notification with userInfo: %@", userInfo);

    // Find imageUrl in the payload
    NSString *imageUrlString = [self extractImageUrlFromUserInfo:userInfo];

    if (!imageUrlString || imageUrlString.length == 0) {
        NSLog(@"[ShopUnite NSE] No imageUrl found, delivering as-is");
        self.contentHandler(self.bestAttemptContent);
        return;
    }

    NSLog(@"[ShopUnite NSE] Found imageUrl: %@", imageUrlString);

    // Download and attach the image
    [self downloadImageAndAttach:imageUrlString];
}

- (NSString *)extractImageUrlFromUserInfo:(NSDictionary *)userInfo {
    // Expo sends data in various formats, check all possibilities
    // Log all keys for debugging
    NSLog(@"[ShopUnite NSE] userInfo keys: %@", userInfo.allKeys);

    // 1. Direct in userInfo (custom field)
    if (userInfo[@"imageUrl"] && [userInfo[@"imageUrl"] isKindOfClass:[NSString class]]) {
        NSLog(@"[ShopUnite NSE] Found imageUrl directly in userInfo");
        return userInfo[@"imageUrl"];
    }

    // 2. In "richContent" dictionary (Expo official API)
    if (userInfo[@"richContent"] && [userInfo[@"richContent"] isKindOfClass:[NSDictionary class]]) {
        NSDictionary *richContent = userInfo[@"richContent"];
        if (richContent[@"image"] && [richContent[@"image"] isKindOfClass:[NSString class]]) {
            NSLog(@"[ShopUnite NSE] Found image in richContent");
            return richContent[@"image"];
        }
    }

    // 3. In the "body" dictionary (Expo format)
    if (userInfo[@"body"] && [userInfo[@"body"] isKindOfClass:[NSDictionary class]]) {
        NSDictionary *body = userInfo[@"body"];
        if (body[@"imageUrl"]) {
            NSLog(@"[ShopUnite NSE] Found imageUrl in body");
            return body[@"imageUrl"];
        }
        if (body[@"richContent"] && [body[@"richContent"] isKindOfClass:[NSDictionary class]]) {
            NSDictionary *richContent = body[@"richContent"];
            if (richContent[@"image"]) {
                NSLog(@"[ShopUnite NSE] Found image in body.richContent");
                return richContent[@"image"];
            }
        }
    }

    // 4. In "data" dictionary
    if (userInfo[@"data"] && [userInfo[@"data"] isKindOfClass:[NSDictionary class]]) {
        NSDictionary *data = userInfo[@"data"];
        if (data[@"imageUrl"]) {
            NSLog(@"[ShopUnite NSE] Found imageUrl in data");
            return data[@"imageUrl"];
        }
    }

    // 5. In "aps" dictionary
    if (userInfo[@"aps"] && [userInfo[@"aps"] isKindOfClass:[NSDictionary class]]) {
        NSDictionary *aps = userInfo[@"aps"];
        if (aps[@"imageUrl"]) {
            NSLog(@"[ShopUnite NSE] Found imageUrl in aps");
            return aps[@"imageUrl"];
        }
    }

    // 6. In "experienceId" related Expo fields
    if (userInfo[@"experienceId"]) {
        NSLog(@"[ShopUnite NSE] This is an Expo notification (experienceId found)");
    }

    // 7. Search in all nested dictionaries for any image-related field
    for (NSString *key in userInfo.allKeys) {
        id value = userInfo[key];
        if ([value isKindOfClass:[NSDictionary class]]) {
            NSDictionary *dict = (NSDictionary *)value;
            // Check for imageUrl
            if (dict[@"imageUrl"] && [dict[@"imageUrl"] isKindOfClass:[NSString class]]) {
                NSLog(@"[ShopUnite NSE] Found imageUrl in nested dict: %@", key);
                return dict[@"imageUrl"];
            }
            // Check for image (Expo richContent style)
            if (dict[@"image"] && [dict[@"image"] isKindOfClass:[NSString class]]) {
                NSLog(@"[ShopUnite NSE] Found image in nested dict: %@", key);
                return dict[@"image"];
            }
        }
    }

    NSLog(@"[ShopUnite NSE] No image URL found in any location");
    return nil;
}

- (void)downloadImageAndAttach:(NSString *)imageUrlString {
    NSURL *imageUrl = [NSURL URLWithString:imageUrlString];

    if (!imageUrl) {
        NSLog(@"[ShopUnite NSE] Invalid URL: %@", imageUrlString);
        self.contentHandler(self.bestAttemptContent);
        return;
    }

    NSURLSessionDownloadTask *task = [[NSURLSession sharedSession] downloadTaskWithURL:imageUrl completionHandler:^(NSURL * _Nullable location, NSURLResponse * _Nullable response, NSError * _Nullable error) {

        if (error) {
            NSLog(@"[ShopUnite NSE] Download error: %@", error.localizedDescription);
            self.contentHandler(self.bestAttemptContent);
            return;
        }

        if (!location) {
            NSLog(@"[ShopUnite NSE] No download location");
            self.contentHandler(self.bestAttemptContent);
            return;
        }

        // Determine file extension from MIME type
        NSString *fileExtension = @"jpg";
        NSString *mimeType = response.MIMEType;

        if ([mimeType containsString:@"png"]) {
            fileExtension = @"png";
        } else if ([mimeType containsString:@"gif"]) {
            fileExtension = @"gif";
        } else if ([mimeType containsString:@"jpeg"] || [mimeType containsString:@"jpg"]) {
            fileExtension = @"jpg";
        }

        // Create temp file with correct extension
        NSString *tempFileName = [NSString stringWithFormat:@"%@.%@", [[NSUUID UUID] UUIDString], fileExtension];
        NSURL *tempFileUrl = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:tempFileName]];

        NSError *moveError = nil;
        [[NSFileManager defaultManager] moveItemAtURL:location toURL:tempFileUrl error:&moveError];

        if (moveError) {
            NSLog(@"[ShopUnite NSE] File move error: %@", moveError.localizedDescription);
            self.contentHandler(self.bestAttemptContent);
            return;
        }

        // Create notification attachment
        NSError *attachmentError = nil;
        UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"image" URL:tempFileUrl options:nil error:&attachmentError];

        if (attachmentError) {
            NSLog(@"[ShopUnite NSE] Attachment error: %@", attachmentError.localizedDescription);
            self.contentHandler(self.bestAttemptContent);
            return;
        }

        if (attachment) {
            NSLog(@"[ShopUnite NSE] Successfully attached image!");
            self.bestAttemptContent.attachments = @[attachment];
        }

        self.contentHandler(self.bestAttemptContent);
    }];

    [task resume];
}

- (void)serviceExtensionTimeWillExpire {
    NSLog(@"[ShopUnite NSE] Time expired, delivering best attempt");
    self.contentHandler(self.bestAttemptContent);
}

@end
