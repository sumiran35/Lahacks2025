import requests
import os
import argparse
import webbrowser
from PIL import Image
from io import BytesIO

def generate_image_variation(server_url, image_path, prompt=None, n_variations=1, size="1024x1024", model="dall-e-2"):
    """
    Generate variations of an image using the Flask API endpoint.
    
    Args:
        server_url (str): Base URL of the Flask server
        image_path (str): Path to the image file
        prompt (str, optional): Text prompt to guide the variation generation
        n_variations (int, optional): Number of variations to generate (default: 1)
        size (str, optional): Size of generated images (default: 1024x1024)
        model (str, optional): Model to use (default: dall-e-2)
        
    Returns:
        dict: Response from the server containing variation URLs
    """
    # Ensure the endpoint URL is correctly formatted
    if not server_url.endswith('/'):
        server_url += '/'
    endpoint_url = f"{server_url}generate-image-variation"
    
    # Prepare the multipart/form-data payload
    files = {'image': open(image_path, 'rb')}
    
    # Prepare form data
    form_data = {
        'n': str(n_variations),
        'size': size,
        'model': model
    }
    
    # Add prompt if provided
    if prompt:
        form_data['prompt'] = prompt
    
    try:
        # Send POST request to the endpoint
        response = requests.post(
            endpoint_url,
            files=files,
            data=form_data
        )
        
        # Check if request was successful
        response.raise_for_status()
        
        # Parse and return JSON response
        result = response.json()
        
        # Close the file
        files['image'].close()
        
        return result
    
    except requests.exceptions.RequestException as e:
        # Close the file if there was an error
        files['image'].close()
        print(f"Error: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print(f"Server response: {e.response.json()}")
            except:
                print(f"Server response: {e.response.text}")
        return None

def save_images_from_urls(variation_results, output_dir="output_variations"):
    """
    Save images from the variation URLs to the local filesystem.
    
    Args:
        variation_results (dict): Response from the generate_image_variation function
        output_dir (str, optional): Directory to save the images (default: output_variations)
    
    Returns:
        list: Paths to the saved images
    """
    if not variation_results or not variation_results.get('success'):
        print("No valid variation results to save.")
        return []
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    saved_paths = []
    
    # Download and save each variation
    for i, variation in enumerate(variation_results.get('variations', [])):
        try:
            # Get image URL
            image_url = variation.get('url')
            if not image_url:
                print(f"No URL found for variation {i+1}")
                continue
            
            # Download image
            response = requests.get(image_url)
            response.raise_for_status()
            
            # Create image from the response content
            img = Image.open(BytesIO(response.content))
            
            # Generate output filename
            output_path = os.path.join(output_dir, f"variation_{i+1}.png")
            
            # Save image
            img.save(output_path)
            saved_paths.append(output_path)
            print(f"Saved variation {i+1} to {output_path}")
            
        except Exception as e:
            print(f"Error saving variation {i+1}: {str(e)}")
    
    return saved_paths

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Generate variations of an image using OpenAI API')
    parser.add_argument('--server', type=str, default='http://localhost:8000',
                        help='URL of the Flask server (default: http://localhost:8000)')
    parser.add_argument('--image', type=str, required=True,
                        help='Path to the image file')
    parser.add_argument('--prompt', type=str, default=None,
                        help='Text prompt to guide the variation generation')
    parser.add_argument('--n', type=int, default=1,
                        help='Number of variations to generate (default: 1, max: 4)')
    parser.add_argument('--size', type=str, default='1024x1024',
                        help='Size of generated images (default: 1024x1024)')
    parser.add_argument('--model', type=str, default='dall-e-2',
                        help='Model to use (default: dall-e-2)')
    parser.add_argument('--output-dir', type=str, default='output_variations',
                        help='Directory to save the images (default: output_variations)')
    parser.add_argument('--save', action='store_true',
                        help='Save the generated images locally')
    parser.add_argument('--browser', action='store_true',
                        help='Open the generated images in a web browser')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Generate variations
    print(f"Generating {args.n} variation(s) for image: {args.image}")
    if args.prompt:
        print(f"Using prompt: {args.prompt}")
    
    result = generate_image_variation(
        args.server,
        args.image,
        prompt=args.prompt,
        n_variations=args.n,
        size=args.size,
        model=args.model
    )
    
    if not result:
        print("Failed to generate variations.")
        return
    
    # Display results
    if result.get('success'):
        print("\nVariations generated successfully!")
        for i, variation in enumerate(result.get('variations', [])):
            print(f"Variation {i+1}: {variation.get('url')}")
        
        # Save images if requested
        saved_paths = []
        if args.save:
            saved_paths = save_images_from_urls(result, args.output_dir)
        
        # Open in browser if requested
        if args.browser:
            for variation in result.get('variations', []):
                url = variation.get('url')
                if url:
                    print(f"Opening in browser: {url}")
                    webbrowser.open(url)
    else:
        print(f"Error: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    main()