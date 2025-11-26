import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        // Buscar la URL de imagen en el payload
        // Expo envía los datos en "body" -> "data" -> "imageUrl"
        var imageUrlString: String?

        // Intentar obtener imageUrl de diferentes ubicaciones del payload
        if let data = request.content.userInfo["body"] as? [String: Any],
           let url = data["imageUrl"] as? String {
            imageUrlString = url
        } else if let url = request.content.userInfo["imageUrl"] as? String {
            imageUrlString = url
        } else if let data = request.content.userInfo["data"] as? [String: Any],
                  let url = data["imageUrl"] as? String {
            imageUrlString = url
        }

        // Si encontramos una URL de imagen, descargarla
        guard let urlString = imageUrlString,
              let imageUrl = URL(string: urlString) else {
            contentHandler(bestAttemptContent)
            return
        }

        // Descargar la imagen
        downloadImage(from: imageUrl) { attachment in
            if let attachment = attachment {
                bestAttemptContent.attachments = [attachment]
            }
            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Llamado justo antes de que la extensión sea terminada por el sistema
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    private func downloadImage(from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { localUrl, response, error in
            guard let localUrl = localUrl, error == nil else {
                completion(nil)
                return
            }

            // Determinar la extensión del archivo
            let fileExtension: String
            if let mimeType = response?.mimeType {
                switch mimeType {
                case "image/jpeg":
                    fileExtension = "jpg"
                case "image/png":
                    fileExtension = "png"
                case "image/gif":
                    fileExtension = "gif"
                default:
                    fileExtension = "jpg"
                }
            } else {
                fileExtension = url.pathExtension.isEmpty ? "jpg" : url.pathExtension
            }

            // Crear archivo temporal con la extensión correcta
            let tempDirectory = FileManager.default.temporaryDirectory
            let tempFile = tempDirectory.appendingPathComponent(UUID().uuidString + "." + fileExtension)

            do {
                // Mover el archivo descargado
                try FileManager.default.moveItem(at: localUrl, to: tempFile)

                // Crear el attachment
                let attachment = try UNNotificationAttachment(identifier: UUID().uuidString, url: tempFile, options: nil)
                completion(attachment)
            } catch {
                print("Error creating attachment: \(error)")
                completion(nil)
            }
        }
        task.resume()
    }
}
