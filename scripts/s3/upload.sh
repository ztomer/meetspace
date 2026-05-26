CREDENTIALS_FILE="$HOME/meetspace-s3.toml"
BUCKET="fastrepl-meetspace-3bek8idy1fyk93awygrqyqpyzs1b4use1a-s3alias"

FROM_PATH="$HOME/dev/meetspace/.cache/"
TO_PATH="v0/"

AWS_REGION=us-east-1 s5cmd \
    --log trace \
    --credentials-file "$CREDENTIALS_FILE" \
    cp "$FROM_PATH" "s3://$BUCKET/$TO_PATH"
