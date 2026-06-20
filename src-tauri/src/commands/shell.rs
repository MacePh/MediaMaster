use arboard::{Clipboard, ImageData};
use std::path::Path;

#[tauri::command]
pub fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("File not found: {path}"));
    }

    let image = image::open(file_path).map_err(|error| error.to_string())?;
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();

    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_image(ImageData {
            width: width as usize,
            height: height as usize,
            bytes: rgba.into_raw().into(),
        })
        .map_err(|error| error.to_string())?;

    Ok(())
}
